import { extractFromHtml } from "./extractText.js";
import {
  classifyAiRelated,
  looksLikeSoft404,
  SkipIngest,
} from "./filters.js";
import { pythonIngestPdf, pythonIngestRaw } from "./pythonBridge.js";
import {
  persistArticleWithJob,
  type PersistArticleResult,
} from "./persist.js";

export type IngestOptions = {
  url?: string;
  title?: string;
  source?: "manual" | "rss";
};

/** Port of `ingest_html`. */
export async function ingestHtml(
  html: string,
  options: IngestOptions = {},
): Promise<PersistArticleResult> {
  const url = options.url ?? "";
  const title = options.title ?? "";
  const source = options.source ?? "manual";

  if (!html.trim()) {
    throw new SkipIngest("empty html");
  }

  const text = extractFromHtml(html);

  if (looksLikeSoft404(html, 200, { extractedText: text })) {
    throw new SkipIngest("soft-404 or too little text");
  }

  const [ok, details] = classifyAiRelated(text, { title, url });
  if (!ok) {
    throw new SkipIngest(
      `not ai-related (inc=${details.include_hits}, exc=${details.exclude_hits}, thr=${details.threshold})`,
    );
  }

  return persistArticleWithJob({
    text,
    html,
    url,
    title: title || url,
    source,
  });
}

/** Port of `ingest_pdf` — extraction + classification via Python. */
export async function ingestPdf(
  pdfBytes: Buffer,
  options: IngestOptions = {},
): Promise<PersistArticleResult> {
  const url = options.url ?? "";
  const title = options.title ?? "";
  const source = options.source ?? "manual";

  const result = await pythonIngestPdf(pdfBytes, { url, title });

  return persistArticleWithJob({
    text: result.text,
    html: null,
    url,
    title: result.title || title || url,
    source,
  });
}

/** Port of `ingest_raw_text` — normalization + classification via Python. */
export async function ingestRawText(
  raw: string,
  options: IngestOptions = {},
): Promise<PersistArticleResult> {
  const url = options.url ?? "";
  const title = options.title ?? "";
  const source = options.source ?? "manual";

  const result = await pythonIngestRaw(raw, { url, title });

  return persistArticleWithJob({
    text: result.text,
    html: null,
    url,
    title: result.title || title || url,
    source,
  });
}
