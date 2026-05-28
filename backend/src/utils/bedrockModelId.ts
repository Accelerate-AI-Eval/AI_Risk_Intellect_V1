/**
 * Bedrock cross-region inference profile IDs use a `us.` prefix
 * (e.g. us.anthropic.claude-haiku-4-5-20251001-v1:0).
 */

const BEDROCK_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9.:-]*$/i;

export function stripUsModelPrefix(modelId: string): string {
  const trimmed = modelId.trim();
  if (trimmed.toLowerCase().startsWith("us.")) {
    return trimmed.slice(3);
  }
  return trimmed;
}

/** True for provider-style Bedrock ids (anthropic.*, meta.*, …), not short aliases. */
export function isBedrockProviderModelId(modelId: string): boolean {
  const trimmed = modelId.trim();
  if (!trimmed || trimmed.includes("/")) return false;
  return BEDROCK_MODEL_ID_PATTERN.test(trimmed);
}

export function withUsModelPrefix(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) return trimmed;
  if (trimmed.toLowerCase().startsWith("us.")) return trimmed;
  if (isBedrockProviderModelId(trimmed)) {
    return `us.${trimmed}`;
  }
  return trimmed;
}
