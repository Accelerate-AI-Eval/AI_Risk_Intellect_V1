import Parser from "rss-parser";
import {
  gatherRssFeedUrls,
  loadSourcesConfig,
  type SourcesConfig,
} from "../config/sourcesConfig.js";
import {
  enqueueDiscoveryBatch,
  getActiveJobUrls,
} from "../services/admin/discoveryEnqueue.service.js";
import { normalizeUrl } from "../utils/fetchUtils.js";

const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`[DISCOVERY] INFO: ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`[DISCOVERY] WARN: ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`[DISCOVERY] ERROR: ${msg}`, ...args),
};

const DEFAULT_INTERVAL_MIN = 15;
const DEFAULT_MAX_PER_CYCLE = 50;

const parser = new Parser({
  timeout: 20_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; AIRiskIntellect-Discovery/1.0; +https://localhost)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function cycleIntervalMs(config: SourcesConfig): number {
  const envMin = process.env.AUTO_INGEST_INTERVAL_MIN?.trim();
  if (envMin) {
    const n = Number.parseInt(envMin, 10);
    if (Number.isFinite(n) && n > 0) {
      return n * 60 * 1000;
    }
  }
  return config.poll_interval_seconds * 1000;
}

function cycleCap(): number {
  const raw = process.env.AUTO_INGEST_MAX_PER_CYCLE?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return DEFAULT_MAX_PER_CYCLE;
}

/** Discover article URLs grouped by RSS feed URL. */
async function discoverUrlsBySource(
  feedUrls: string[],
): Promise<Map<string, string[]>> {
  const urlsBySource = new Map<string, string[]>();

  log.info("[rss-discovery] scanning %d RSS feeds", feedUrls.length);

  for (const feedUrl of feedUrls) {
    try {
      const parsed = await parser.parseURL(feedUrl);
      const sourceUrls: string[] = [];

      for (const item of parsed.items ?? []) {
        const link = item.link?.trim() || item.guid?.trim();
        if (!link || !/^https?:\/\//i.test(link)) continue;
        try {
          sourceUrls.push(normalizeUrl(link));
        } catch {
          // skip invalid URLs
        }
      }

      for (let i = sourceUrls.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [sourceUrls[i], sourceUrls[j]] = [sourceUrls[j]!, sourceUrls[i]!];
      }

      urlsBySource.set(feedUrl, sourceUrls);
      log.info(
        "[rss-discovery] found %d URLs from %s",
        sourceUrls.length,
        feedUrl,
      );
    } catch (err) {
      log.error("[rss-discovery] RSS parse error for %s: %s", feedUrl, String(err));
    }
  }

  return urlsBySource;
}

/**
 * Round-robin balanced selection across feeds so no single source dominates.
 * Port of `_balanced_selection` in Python rss_discovery.py.
 */
function balancedSelection(
  urlsBySource: Map<string, string[]>,
  cap: number,
): string[] {
  if (urlsBySource.size === 0 || cap <= 0) {
    return [];
  }

  const sources = [...urlsBySource.keys()];
  const selected: string[] = [];
  const urlsPerSource = Math.max(1, Math.floor(cap / sources.length));
  let remaining = cap;

  log.info(
    "[rss-discovery] balanced selection: %d sources, ~%d URLs per source",
    sources.length,
    urlsPerSource,
  );

  for (const source of sources) {
    if (remaining <= 0) break;

    const sourceUrls = urlsBySource.get(source) ?? [];
    const take = Math.min(urlsPerSource, sourceUrls.length, remaining);
    selected.push(...sourceUrls.slice(0, take));
    remaining -= take;

    log.info("[rss-discovery] selected %d URLs from %s", take, source);
  }

  if (remaining > 0) {
    const leftovers: string[] = [];
    for (const source of sources) {
      const sourceUrls = urlsBySource.get(source) ?? [];
      const startIdx = Math.min(urlsPerSource, sourceUrls.length);
      leftovers.push(...sourceUrls.slice(startIdx));
    }

    for (let i = leftovers.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [leftovers[i], leftovers[j]] = [leftovers[j]!, leftovers[i]!];
    }

    const fill = leftovers.slice(0, remaining);
    selected.push(...fill);
    log.info(
      "[rss-discovery] filled %d remaining slots randomly",
      fill.length,
    );
  }

  return selected;
}

async function runDiscoveryCycle(config: SourcesConfig): Promise<void> {
  const cap = cycleCap();
  const feedUrls = gatherRssFeedUrls(config);

  if (feedUrls.length === 0) {
    log.warn("[rss-discovery] no RSS feeds configured");
    return;
  }

  const urlsBySource = await discoverUrlsBySource(feedUrls);
  const activeJobs = await getActiveJobUrls();

  const filteredBySource = new Map<string, string[]>();
  for (const [source, urls] of urlsBySource) {
    const fresh = urls.filter((u) => u && !activeJobs.has(u));
    if (fresh.length > 0) {
      filteredBySource.set(source, fresh);
    }
  }

  const selected = balancedSelection(filteredBySource, cap);

  if (selected.length === 0) {
    log.info("[rss-discovery] no new URLs this cycle");
    return;
  }

  const n = await enqueueDiscoveryBatch(selected);
  log.info(
    "[rss-discovery] queued %d new articles (balanced across %d sources)",
    n,
    filteredBySource.size,
  );
}

/**
 * Port of `app.workers.rss_discovery.auto_ingest_loop`.
 */
export async function autoIngestLoop(
  stopSignal: AbortSignal,
  configPath: string,
  options?: { runOnce?: boolean },
): Promise<void> {
  const runOnce = options?.runOnce ?? false;
  const config = loadSourcesConfig(configPath);
  const intervalMs = cycleIntervalMs(config);
  const cap = cycleCap();

  log.info(
    "[rss-discovery] started (interval=%d min, cap=%d, run_once=%s)",
    Math.round(intervalMs / 60_000),
    cap,
    runOnce,
  );

  do {
    if (stopSignal.aborted) break;

    const t0 = Date.now();
    try {
      await runDiscoveryCycle(config);
    } catch (err) {
      if (stopSignal.aborted) break;
      log.error("[rss-discovery] error during cycle: %s", String(err));
    }

    if (runOnce || stopSignal.aborted) break;

    const elapsed = Date.now() - t0;
    const sleepMs = Math.max(5_000, intervalMs - elapsed);

    try {
      await sleep(sleepMs, stopSignal);
    } catch {
      break;
    }
  } while (!stopSignal.aborted);

  log.info("[rss-discovery] exiting");
}
