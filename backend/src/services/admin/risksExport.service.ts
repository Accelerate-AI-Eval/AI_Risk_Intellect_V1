import * as XLSX from "xlsx";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles } from "../../schema/articles/articles.js";
import { risks } from "../../schema/risks/risks.js";
import { mapRiskRowToDto } from "../risks/riskDto.js";
import { fetchGlobalRiskDisplayIdMap } from "../risks/riskSequence.js";
import { decodeDisplayTitle } from "../../utils/decodeHtmlEntities.js";

function formatExportDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function exportDateStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthName = now.toLocaleString('en-US', { month: 'short' }); // "Jul"
  return `${now.getFullYear()}-${monthName}-${pad(now.getDate())}`;
}

export async function buildRisksExportExcel(): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const [riskRows, articleRows] = await Promise.all([
    db
      .select({
        id: risks.id,
        articleId: risks.articleId,
        riskTitle: risks.riskTitle,
        domains: risks.domains,
        primaryRisk: risks.primaryRisk,
        secondaryRisk: risks.secondaryRisk,
        sector: risks.sector,
        industry: risks.industry,
      intent: risks.intent,
      qualityScore: risks.qualityScore,
      likelihood: risks.likelihood,
      impact: risks.impact,
      severityScore: risks.severityScore,
      severityBand: risks.severityBand,
      aiProductName: risks.aiProductName,
      aiProductVendor: risks.aiProductVendor,
      extractionJson: risks.extractionJson,
        modelName: risks.modelName,
        createdAt: risks.createdAt,
        articleTitle: articles.title,
        articleUrl: articles.url,
      })
      .from(risks)
      .innerJoin(articles, eq(risks.articleId, articles.id))
      .orderBy(desc(risks.createdAt)),
    db.select().from(articles).orderBy(asc(articles.id)),
  ]);

  const displayIdByRiskId = await fetchGlobalRiskDisplayIdMap();
  const mappedRisks = riskRows.map((row) =>
    mapRiskRowToDto(row, displayIdByRiskId.get(row.id) ?? "R-?"),
  );

  const exportedAt = formatExportDateTime(new Date());

  const risksSheet = XLSX.utils.aoa_to_sheet([
    ["Exported At", exportedAt],
    [],
    [
      "Display ID",
      // "Risk ID",
      "Title",
      "Domain",
      "Primary Risk",
      "Secondary Risk",
      "Sector",
      "Industry",
      "Intent",
      "Likelihood",
      "Impact",
      "Severity Score",
      "Severity Band",
      "AI Product",
      "AI Vendor",
      "Quality Score",
      "Confidence",
      "Description",
      "Attack Vector",
      "Article ID",
      "Article Title",
      "Article URL",
      "Model Name",
      "Review Status",
      "Reviewed By",
      "Reviewed At",
      "Ingested At",
    ],
    ...mappedRisks.map((risk) => [
      risk.displayId,
      // risk.id,
      risk.title,
      risk.domain,
      risk.primaryRisk,
      risk.secondaryRisk,
      risk.sector,
      risk.industry,
      risk.intent,
      risk.riskScoring.likelihood ?? "",
      risk.riskScoring.impact ?? "",
      risk.riskScoring.severityScore ?? "",
      risk.riskScoring.severityBand !== "—" ? risk.riskScoring.severityBand : "",
      risk.product.name ?? "",
      risk.product.vendor ?? "",
      risk.qualityScore,
      risk.confidence,
      risk.description,
      risk.attackVector,
      risk.articleId,
      risk.articleTitle,
      risk.articleUrl,
      risk.modelName ?? "",
      risk.humanReview.status ?? "",
      risk.humanReview.reviewedBy ?? "",
      formatExportDateTime(risk.humanReview.reviewedAt),
      formatExportDateTime(risk.ingestedAt),
    ]),
  ]);
  risksSheet["!cols"] = [
    { wch: 10 },
    { wch: 38 },
    { wch: 48 },
    { wch: 36 },
    { wch: 28 },
    { wch: 28 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 64 },
    { wch: 36 },
    { wch: 10 },
    { wch: 40 },
    { wch: 56 },
    { wch: 28 },
    { wch: 14 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
  ];

  const articlesSheet = XLSX.utils.aoa_to_sheet([
    ["ID", "URL", "Title", "Risk Count", "Created At", "Updated At"],
    ...articleRows.map((article) => [
      article.id,
      article.url,
      decodeDisplayTitle(article.title, ""),
      article.riskCount,
      formatExportDateTime(article.createdAt),
      formatExportDateTime(article.updatedAt),
    ]),
  ]);
  articlesSheet["!cols"] = [
    { wch: 8 },
    { wch: 72 },
    { wch: 48 },
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
  ];

  const tagsSheet = XLSX.utils.aoa_to_sheet([
    [
      "Display ID",
      "Risk ID",
      "Domain",
      "Primary Risk",
      "Secondary Risk",
      "Sector",
      "Industry",
      "Intent",
      "Primary Key",
      "Tag Key",
      "Confidence",
    ],
    ...mappedRisks.map((risk) => [
      risk.displayId,
      risk.id,
      risk.domain,
      risk.primaryRisk,
      risk.secondaryRisk,
      risk.sector,
      risk.industry,
      risk.intent,
      risk.primaryKey,
      risk.tagKey,
      risk.confidence,
    ]),
  ]);
  tagsSheet["!cols"] = [
    { wch: 10 },
    { wch: 38 },
    { wch: 36 },
    { wch: 28 },
    { wch: 28 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, risksSheet, "Risks");
  XLSX.utils.book_append_sheet(workbook, articlesSheet, "Articles");
  XLSX.utils.book_append_sheet(workbook, tagsSheet, "Tags");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return {
    buffer,
    fileName: `risks-export-${exportDateStamp()}.xlsx`,
  };
}
