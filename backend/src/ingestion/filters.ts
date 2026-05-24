import { SkipIngest } from "./errors.js";

export { SkipIngest };

// ---------- Soft 404 / empty-content detection ----------

const SOFT_404_PAT =
  /(404|not\s+found|page\s+not\s+found|page\s+removed|gone|error\s+404)/i;

/** Detect real and "soft" 404s or nav-only pages. Port of `looks_like_soft_404`. */
export function looksLikeSoft404(
  html: string,
  status: number,
  options?: { extractedText?: string | null; minTextBytes?: number },
): boolean {
  const minTextBytes = options?.minTextBytes ?? 500;
  const extractedText = options?.extractedText;

  if (status === 404 || status === 410 || status === 451) {
    return true;
  }

  if (html && SOFT_404_PAT.test(html.slice(0, 2000) || "")) {
    return true;
  }

  if (extractedText != null && extractedText.trim().length < minTextBytes) {
    return true;
  }

  return false;
}

// ---------- Fast AI-topic classifier (regex keywords; no LLM) ----------

const AI_INCLUDE = [
  /\b(ai|artificial intelligence)\b/i,
  /\b(llm|large language model|language model)\b/i,
  /\b(machine learning|ml|deep learning|neural network)\b/i,
  /\b(embedding|token|inference|fine[- ]?tuning|rlhf|safety|alignment)\b/i,
  /\b(prompt|prompt injection|jailbreak|hallucination|red teaming)\b/i,
  /\b(model weights?|training data|dataset|inference api)\b/i,
  /\b(privacy|pii|data leakage|governance|compliance) in (ai|ml)\b/i,
];

const AI_EXCLUDE = [
  /\b(sports|football|basketball|baseball|soccer|golf|tennis)\b/i,
  /\b(recipes?|cooking|travel|tourism|celebrity|fashion|beauty)\b/i,
  /\b(stock photos?|coupon|promo|giveaway)\b/i,
];

function hitCount(text: string, patterns: RegExp[]): number {
  const low = (text || "").toLowerCase();
  return patterns.reduce((n, p) => (p.test(low) ? n + 1 : n), 0);
}

export type ClassifyDetails = {
  include_hits: number;
  exclude_hits: number;
  threshold: number;
};

/** Simple deterministic filter. Port of `classify_ai_related`. */
export function classifyAiRelated(
  text: string,
  options?: { title?: string; url?: string; includeThreshold?: number },
): [boolean, ClassifyDetails] {
  const title = options?.title ?? "";
  const url = options?.url ?? "";
  const threshold = options?.includeThreshold ?? 2;
  const blob = [title, url, text].join(" ").trim();

  const include_hits = hitCount(blob, AI_INCLUDE);
  const exclude_hits = hitCount(blob, AI_EXCLUDE);
  const ok = include_hits - exclude_hits >= threshold;

  return [ok, { include_hits, exclude_hits, threshold }];
}
