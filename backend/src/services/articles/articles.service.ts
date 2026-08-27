import { and, asc, desc, eq, gt, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles } from "../../schema/articles/articles.js";
import { decodeDisplayTitle } from "../../utils/decodeHtmlEntities.js";
import type { ListArticlesQuery } from "../../validators/articles.validators.js";

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

export type ArticleListPagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

function buildArticleFilters(query: ListArticlesQuery): SQL | undefined {
  const parts: SQL[] = [];
  const search = query.search.trim();
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const textMatch = or(
      ilike(articles.title, pattern),
      ilike(articles.url, pattern),
      sql`(${articles.id})::text ilike ${pattern}`,
    );
    if (textMatch) parts.push(textMatch);
  }
  if (query.risks === "with") parts.push(gt(articles.riskCount, 0));
  if (query.risks === "none") parts.push(eq(articles.riskCount, 0));
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : and(...parts);
}

export async function listArticles(query: ListArticlesQuery): Promise<{
  articles: ArticleListItem[];
  metrics: ArticleListMetrics;
  pagination: ArticleListPagination;
}> {
  const filters = buildArticleFilters(query);
  const orderBy =
    query.order === "oldest"
      ? asc(articles.createdAt)
      : desc(articles.createdAt);
  const offset = query.page * query.pageSize;

  const [rows, [filtered], [agg]] = await Promise.all([
    db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        riskCount: articles.riskCount,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(filters)
      .orderBy(orderBy)
      .limit(query.pageSize)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(articles)
      .where(filters),
    db
      .select({
        total: sql<number>`count(*)::int`,
        risksExtracted: sql<number>`coalesce(sum(${articles.riskCount}), 0)::int`,
      })
      .from(articles),
  ]);

  const filteredTotal = filtered?.total ?? 0;
  const total = agg?.total ?? 0;
  const risksExtracted = agg?.risksExtracted ?? 0;
  const pageCount = Math.max(1, Math.ceil(filteredTotal / query.pageSize));

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
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: filteredTotal,
      pageCount,
    },
  };
}
