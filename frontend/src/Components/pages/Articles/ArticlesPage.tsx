import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "react-toastify";
import {
  ExternalLink,
  FileText,
  FilterX,
  RefreshCw,
  Search,
  Shield,
} from "lucide-react";
import { authFetch } from "../../../utils/authFetch";
import { decodeDisplayTitle } from "../../../utils/decodeHtmlEntities";
import { formatDisplayDate } from "../../../utils/formatDate";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { PageHeader } from "../../Layout/PageHeader";
import { DataTablePagination } from "../../common/DataTablePagination";
import "../Users/usersPage.css";
import "../Jobs/jobsPage.css";
import "./articlesPage.css";

type ArticleRow = {
  id: number;
  title: string;
  url: string;
  risks: number;
  created: string;
  createdAt: string;
};

type ArticleMetrics = {
  total: number;
  risksExtracted: number;
  avgRisksPerArticle: number;
};

type ArticlePagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

function normalizeArticlesFromApi(raw: unknown): {
  articles: ArticleRow[];
  metrics: ArticleMetrics;
  pagination: ArticlePagination;
} {
  const data = raw as {
    articles?: Array<{
      id?: number;
      title?: string | null;
      url?: string;
      riskCount?: number;
      createdAt?: string;
    }>;
    metrics?: Partial<ArticleMetrics>;
    pagination?: Partial<ArticlePagination>;
  };

  const articles: ArticleRow[] = (data.articles ?? []).map((a) => ({
    id: a.id ?? 0,
    title: decodeDisplayTitle(a.title, "Untitled"),
    url: a.url ?? "",
    risks: a.riskCount ?? 0,
    created: a.createdAt ? formatDisplayDate(a.createdAt) : "—",
    createdAt: a.createdAt ?? "",
  }));

  const filteredTotal = data.pagination?.total ?? articles.length;
  const pageSize = data.pagination?.pageSize ?? 10;

  return {
    articles,
    metrics: {
      total: data.metrics?.total ?? articles.length,
      risksExtracted: data.metrics?.risksExtracted ?? 0,
      avgRisksPerArticle: data.metrics?.avgRisksPerArticle ?? 0,
    },
    pagination: {
      page: data.pagination?.page ?? 0,
      pageSize,
      total: filteredTotal,
      pageCount:
        data.pagination?.pageCount ??
        Math.max(1, Math.ceil(filteredTotal / pageSize)),
    },
  };
}

export function ArticlesPage() {
  const baseId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [risksFilter, setRisksFilter] = useState<"all" | "with" | "none">("all");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [metrics, setMetrics] = useState<ArticleMetrics>({
    total: 0,
    risksExtracted: 0,
    avgRisksPerArticle: 0,
  });
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [articlePageSize, setArticlePageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filteredTotal, setFilteredTotal] = useState(0);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearch("");
    setRisksFilter("all");
    setOrder("newest");
    setPage(0);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadArticles = useCallback(async () => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      setRows([]);
      setLoadState("idle");
      return;
    }

    setLoadState("loading");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(articlePageSize),
        risks: risksFilter,
        order,
      });
      const q = debouncedSearch.trim();
      if (q) params.set("search", q);

      const path = `/articles?${params.toString()}`;
      console.info("[Articles] request", path);
      const startedAt = performance.now();
      const res = await authFetch(path);
      const elapsedMs = Math.round(performance.now() - startedAt);
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        articles?: unknown[];
        metrics?: unknown;
        pagination?: unknown;
      };
      console.info("[Articles] response", {
        status: res.status,
        ok: res.ok,
        elapsedMs,
        contentType: res.headers.get("content-type"),
        url: res.url,
        error: data.error ?? null,
        articleCount: Array.isArray(data.articles) ? data.articles.length : 0,
        metrics: data.metrics ?? null,
        pagination: data.pagination ?? null,
      });
      if (res.status === 401) {
        console.warn("[Articles] 401 unauthorized", data.error);
        setLoadState("idle");
        return;
      }
      if (!res.ok) {
        console.error("[Articles] load failed", {
          status: res.status,
          elapsedMs,
          error: data.error ?? "Could not load articles.",
        });
        setLoadState("error");
        toast.error(
          data.error?.message ?? "Could not load articles.",
          { autoClose: 3000 },
        );
        return;
      }
      const parsed = normalizeArticlesFromApi(data);
      setRows(parsed.articles);
      setMetrics(parsed.metrics);
      setFilteredTotal(parsed.pagination.total);
      setLoadState("idle");
    } catch (err) {
      console.error("[Articles] network/parse error", err);
      setLoadState("error");
      toast.error("Network error while loading articles.", { autoClose: 3000 });
    }
  }, [page, articlePageSize, risksFilter, order, debouncedSearch]);

  useEffect(() => {
    setDocumentPageTitle("Articles");
  }, []);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  const pageCount = Math.max(1, Math.ceil(filteredTotal / articlePageSize));
  const safePage = Math.min(page, pageCount - 1);
  const from = filteredTotal === 0 ? 0 : safePage * articlePageSize + 1;
  const to = Math.min((safePage + 1) * articlePageSize, filteredTotal);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadArticles();
    setRefreshing(false);
    toast.success("Articles list refreshed.", { autoClose: 2000 });
  }, [loadArticles]);

  const filterId = (name: string) => `${baseId}-${name}`;

  return (
    <main className="mainLayout__content articlesPage jobsPage">
      <PageHeader
        title="Articles"
        subtitle="Source articles and documents."
        actions={
          <button
            type="button"
            className="usersPage__inviteBtn"
            onClick={() => void handleRefresh()}
            disabled={refreshing || loadState === "loading"}
            aria-busy={refreshing || loadState === "loading"}
          >
            <RefreshCw
              size={18}
              strokeWidth={2}
              className={
                refreshing || loadState === "loading"
                  ? "pageHeader__refreshIcon--spin"
                  : undefined
              }
              aria-hidden
            />
            Refresh
          </button>
        }
      />

      <div className="articlesPage__metrics">
        <article className="articlesPage__metric articlesPage__metric--total">
          <div className="articlesPage__metricInner">
            <div className="articlesPage__metricCopy">
              <p className="articlesPage__metricLabel">Total articles</p>
              <p className="articlesPage__metricValue">{metrics.total}</p>
            </div>
            <div className="articlesPage__metricIcon articlesPage__metricIcon--blue">
              <FileText size={22} strokeWidth={2} aria-hidden />
            </div>
          </div>
        </article>
        <article className="articlesPage__metric articlesPage__metric--risks">
          <div className="articlesPage__metricInner">
            <div className="articlesPage__metricCopy">
              <p className="articlesPage__metricLabel">Risks extracted</p>
              <p className="articlesPage__metricValue">{metrics.risksExtracted}</p>
            </div>
            <div className="articlesPage__metricIcon articlesPage__metricIcon--orange">
              <Shield size={22} strokeWidth={2} aria-hidden />
            </div>
          </div>
        </article>
        <article className="articlesPage__metric articlesPage__metric--avg">
          <div className="articlesPage__metricInner">
            <div className="articlesPage__metricCopy">
              <p className="articlesPage__metricLabel">Avg risks/article</p>
              <p className="articlesPage__metricValue articlesPage__metricValue--tabular">
                {metrics.avgRisksPerArticle.toFixed(1)}
              </p>
            </div>
            <div className="articlesPage__metricIcon articlesPage__metricIcon--slate">
              <FileText size={22} strokeWidth={2} aria-hidden />
            </div>
          </div>
        </article>
      </div>

      <section className="jobsPage__filters" aria-label="Filter articles">
        <div className="jobsPage__filter">
          <label htmlFor={filterId("risks")}>RISKS</label>
          <select
            id={filterId("risks")}
            value={risksFilter}
            onChange={(e) => {
              const value = e.target.value;
              setRisksFilter(
                value === "with" || value === "none" ? value : "all",
              );
              setPage(0);
            }}
          >
            <option value="all">All</option>
            <option value="with">Has risks</option>
            <option value="none">No risks</option>
          </select>
        </div>
        <div className="jobsPage__filter">
          <label htmlFor={filterId("order")}>ORDER</label>
          <select
            id={filterId("order")}
            value={order}
            onChange={(e) => {
              setOrder(e.target.value === "oldest" ? "oldest" : "newest");
              setPage(0);
            }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
        <button
          type="button"
          className="jobsPage__clearBtn"
          onClick={clearFilters}
          aria-label="Clear Filter"
          data-tooltip="Clear Filter"
        >
          <FilterX size={18} strokeWidth={2} aria-hidden />
        </button>
        <div className="jobsPage__searchWrap">
          <Search
            className="jobsPage__searchIcon"
            size={18}
            strokeWidth={2}
            aria-hidden
          />
          <input
            id={filterId("search")}
            type="search"
            className="jobsPage__searchInput"
            placeholder="Search title, URL, ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Search articles"
          />
        </div>
      </section>

      <section
        className="articlesPage__tableSection"
        aria-label="Articles table"
      >
        <div className="articlesPage__tableWrap">
          <div className="articlesPage__tableScroll">
            <table className="articlesPage__table">
              <thead>
                <tr>
                  <th scope="col" className="articlesPage__th">
                    ID
                  </th>
                  <th scope="col" className="articlesPage__th">
                    Title
                  </th>
                  <th scope="col" className="articlesPage__th">
                    URL
                  </th>
                  <th scope="col" className="articlesPage__th articlesPage__th--narrow">
                    Risks
                  </th>
                  <th scope="col" className="articlesPage__th">
                    Created
                  </th>
                  <th scope="col" className="articlesPage__th articlesPage__th--actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadState === "loading" ? (
                  <tr>
                    <td className="articlesPage__td articlesPage__td--empty" colSpan={6}>
                      Loading articles…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="articlesPage__td articlesPage__td--empty" colSpan={6}>
                      {searchQuery.trim() || risksFilter !== "all"
                        ? "No articles match your filters or search."
                        : loadState === "error"
                          ? "Could not load articles."
                          : "No articles to display."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="articlesPage__td">
                        <span className="articlesPage__id">#{row.id}</span>
                      </td>
                      <td className="articlesPage__td articlesPage__td--title">
                        {row.title}
                      </td>
                      <td className="articlesPage__td articlesPage__td--url">
                        <a
                          href={row.url}
                          className="articlesPage__url"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {row.url}
                        </a>
                      </td>
                      <td className="articlesPage__td articlesPage__td--center">
                        {row.risks}
                      </td>
                      <td className="articlesPage__td articlesPage__td--muted">
                        {row.created}
                      </td>
                      <td className="articlesPage__td articlesPage__td--actions">
                        <a
                          href={row.url}
                          className="articlesPage__actionLink"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink size={14} strokeWidth={2} aria-hidden />
                          Open
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataTablePagination
            className="articlesPage__pager"
            page={safePage}
            pageCount={pageCount}
            total={filteredTotal}
            pageSize={articlePageSize}
            from={from}
            to={to}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setArticlePageSize(size);
              setPage(0);
            }}
          />
        </div>
      </section>
    </main>
  );
}
