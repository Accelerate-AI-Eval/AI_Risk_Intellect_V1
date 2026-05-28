export type ReviewQueueItem = {
  id: string;
  displayId: string;
  title: string;
  domain: string;
  primaryRisk: string;
  secondaryRisk: string;
  qualityScore: number | null;
  scoreLabel: string;
  priority: "Low" | "Medium" | "High";
  category: string;
  reviewReason: string;
  articleUrl: string;
  ingestedAt: string;
};

export function normalizeReviewQueueFromApi(raw: unknown): {
  items: ReviewQueueItem[];
  total: number;
} {
  const data = raw as { items?: ReviewQueueItem[]; total?: number };
  const items = (data.items ?? []).map((item) => ({
    id: item.id ?? "",
    displayId: item.displayId?.trim() || "R-?",
    title: item.title ?? "Untitled risk",
    domain: item.domain ?? "—",
    primaryRisk: item.primaryRisk ?? "—",
    secondaryRisk: item.secondaryRisk ?? "—",
    qualityScore:
      typeof item.qualityScore === "number" ? item.qualityScore : null,
    scoreLabel: item.scoreLabel ?? "—/100",
    priority: item.priority ?? "Medium",
    category: item.category ?? "—",
    reviewReason:
      item.reviewReason ??
      "Domain could not be mapped to the risk_mappings catalog.",
    articleUrl: item.articleUrl ?? "",
    ingestedAt: item.ingestedAt ?? "",
  }));
  return {
    items,
    total: data.total ?? items.length,
  };
}
