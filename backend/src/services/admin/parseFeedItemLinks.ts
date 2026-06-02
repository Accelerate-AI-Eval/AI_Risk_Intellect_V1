import Parser from "rss-parser";
import { normalizeUrl } from "../../utils/fetchUtils.js";

const parser = new Parser({
  timeout: 20_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; AIRiskIntellect-FeedExtract/1.0; +https://localhost)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

/**
 * Fetch RSS/Atom XML and return unique http(s) item links (normalized).
 */
export async function parseFeedItemLinks(feedUrl: string): Promise<string[]> {
  const parsed = await parser.parseURL(feedUrl);
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const item of parsed.items ?? []) {
    const raw = item.link?.trim() || item.guid?.trim();
    if (!raw || !/^https?:\/\//i.test(raw)) continue;
    try {
      const normalized = normalizeUrl(raw);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
    } catch {
      // skip invalid item URLs
    }
  }

  return urls;
}
