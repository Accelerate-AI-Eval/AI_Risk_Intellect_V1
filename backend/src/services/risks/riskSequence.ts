import { formatRiskDisplayId } from "./riskDisplayId.js";

export type RiskOrderRow = {
  id: string;
  createdAt: Date;
};

export function sortRisksForDisplaySequence(
  rows: RiskOrderRow[],
): RiskOrderRow[] {
  return [...rows].sort((a, b) => {
    const byTime = a.createdAt.getTime() - b.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  });
}

export function buildRiskDisplayIdMap(
  rows: RiskOrderRow[],
): Map<string, string> {
  const sorted = sortRisksForDisplaySequence(rows);
  const total = sorted.length;
  const map = new Map<string, string>();
  sorted.forEach((row, index) => {
    map.set(row.id, formatRiskDisplayId(index + 1, total));
  });
  return map;
}
