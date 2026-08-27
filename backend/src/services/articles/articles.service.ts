import { desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles } from "../../schema/articles/articles.js";
import { decodeDisplayTitle } from "../../utils/decodeHtmlEntities.js";

export type ArticleListItem = {
  id: number;
  title: string | null;
  url: string;
  riskCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ArticleListMetrics = {
  total: number;
  risksExtracted: number;
  avgRisksPerArticle: number;
};

export async function listArticles(): Promise<{
  articles: ArticleListItem[];
  metrics: ArticleListMetrics;
}> {
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.url,
      riskCount: articles.riskCount,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .orderBy(desc(articles.createdAt));

  const [agg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      risksExtracted: sql<number>`coalesce(sum(${articles.riskCount}), 0)::int`,
    })
    .from(articles);

  const total = agg?.total ?? 0;
  const risksExtracted = agg?.risksExtracted ?? 0;

  return {
    articles: rows.map((row) => ({
      ...row,
      title: row.title ? decodeDisplayTitle(row.title) : null,
    })),
    metrics: {
      total,
      risksExtracted,
      avgRisksPerArticle: total > 0 ? risksExtracted / total : 0,
    },
  };
}
