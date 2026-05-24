import { extractTitleFromHtml } from "../../ingestion/extractText.js";
import { looksLikeSoft404, SkipIngest } from "../../ingestion/filters.js";
import {
  ArticleDuplicateError,
  applyIngestToArticle,
  checkArticleDedupExcluding,
} from "../../ingestion/persist.js";
import {
  pythonIngestHtml,
  pythonIngestPdf,
} from "../../ingestion/pythonBridge.js";
import {
  fetchPageContentDetailed,
  validateUrl,
  UrlFetchError,
} from "../../utils/fetchUtils.js";

export type ProcessUrlSuccess = {
  outcome: "done";
  articleId: number;
  title: string | null;
};

export type ProcessUrlSkipped = {
  outcome: "skipped";
  reason: string;
};

export type ProcessUrlResult = ProcessUrlSuccess | ProcessUrlSkipped;

/**
 * Port of `process_url_to_db` — fetch, extract, dedupe, persist on existing article.
 *
 * Terminal outcomes for the worker:
 * - `done` — content stored on article
 * - `skipped` — dedupe, fetch failed, soft-404, not AI-related, etc.
 * - `error` — thrown to caller for exception handling
 */
export async function processUrlToDb(
  url: string,
  articleId: number,
  options?: { title?: string; source?: "manual" | "rss" },
): Promise<ProcessUrlResult> {
  try {
    await validateUrl(url);
  } catch (err) {
    const msg =
      err instanceof UrlFetchError ? err.message : "URL validation failed";
    return { outcome: "skipped", reason: msg };
  }

  const fetched = await fetchPageContentDetailed(url);
  if (!fetched.ok) {
    return {
      outcome: "skipped",
      reason: `fetch failed: ${fetched.reason}`,
    };
  }

  const page = fetched.page;
  const title =
    options?.title?.trim() ||
    (page.kind === "html" ? page.title : "") ||
    url;

  try {
    const isManual = options?.source === "manual";

    if (page.kind === "pdf") {
      const result = await pythonIngestPdf(page.bytes, {
        url,
        title,
        skipAiCheck: isManual,
      });
      const dup = await checkArticleDedupExcluding(
        { url, text: result.text },
        articleId,
      );
      if (dup) {
        return {
          outcome: "skipped",
          reason: `dedupe hit → article ${dup.article.id}`,
        };
      }

      const article = await applyIngestToArticle(articleId, {
        text: result.text,
        html: null,
        url,
        title: result.title || title,
      });

      return {
        outcome: "done",
        articleId: article.id,
        title: article.title,
      };
    }

    const html = page.html;
    if (!html.trim()) {
      return { outcome: "skipped", reason: "empty html" };
    }

    const pageTitle = page.title || extractTitleFromHtml(html) || title;
    const minTextBytes = isManual ? 200 : 500;

    let text: string;
    try {
      const extracted = await pythonIngestHtml(html, {
        url,
        title: pageTitle,
        skipAiCheck: isManual,
      });
      text = extracted.text;
    } catch (err) {
      if (err instanceof SkipIngest) {
        return { outcome: "skipped", reason: err.message };
      }
      throw err;
    }

    if (
      looksLikeSoft404(html, 200, {
        extractedText: text,
        minTextBytes,
      })
    ) {
      return { outcome: "skipped", reason: "soft-404 or too little text" };
    }

    const dup = await checkArticleDedupExcluding({ url, text }, articleId);
    if (dup) {
      return {
        outcome: "skipped",
        reason: `dedupe hit → article ${dup.article.id}`,
      };
    }

    const article = await applyIngestToArticle(articleId, {
      text,
      html,
      url,
      title: pageTitle || url,
    });

    return {
      outcome: "done",
      articleId: article.id,
      title: article.title,
    };
  } catch (err) {
    if (err instanceof SkipIngest) {
      return { outcome: "skipped", reason: err.message };
    }
    if (err instanceof ArticleDuplicateError) {
      return {
        outcome: "skipped",
        reason: `dedupe hit → article ${err.article.id}`,
      };
    }
    throw err;
  }
}
