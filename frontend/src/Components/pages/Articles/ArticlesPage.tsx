import { useCallback, useEffect, useId, useMemo, useState } from "react";
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
import { formatDisplayDate } from "../../../utils/formatDate";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { usePagination } from "../../../utils/usePagination";
import { PageHeader } from "../../Layout/PageHeader";
import { DataTablePagination } from "../../common/DataTablePagination";
import "../Users/usersPage.css";
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

function normalizeArticlesFromApi(raw: unknown): {
  articles: ArticleRow[];
  metrics: ArticleMetrics;
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
  };

  const articles: ArticleRow[] = (data.articles ?? []).map((a) => ({
    id: a.id ?? 0,
    title: a.title?.trim() || "Untitled",
    url: a.url ?? "",
    risks: a.riskCount ?? 0,
    created: a.createdAt ? formatDisplayDate(a.createdAt) : "—",
    createdAt: a.createdAt ?? "",
  }));

  return {
    articles,
    metrics: {
      total: data.metrics?.total ?? articles.length,
      risksExtracted: data.metrics?.risksExtracted ?? 0,
      avgRisksPerArticle: data.metrics?.avgRisksPerArticle ?? 0,
    },
  };
}

export function ArticlesPage() {
  const baseId = useId();
  const [search, setSearch] = useState("");
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

  const clearFilters = useCallback(() => {
    setSearch("");
    setOrder("newest");
  }, []);

  const loadArticles = useCallback(async () => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      setRows([]);
      setLoadState("idle");
      return;
    }

    setLoadState("loading");
    try {
      const res = await authFetch("/articles");
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (res.status === 401) {
        setLoadState("idle");
        return;
      }
      if (!res.ok) {
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
      setLoadState("idle");
    } catch {
      setLoadState("error");
      toast.error("Network error while loading articles.", { autoClose: 3000 });
    }
  }, []);

  useEffect(() => {
    setDocumentPageTitle("Articles");
    void loadArticles();
  }, [loadArticles]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = rows;
    if (q) {
      filtered = rows.filter((a) => {
        const hay = [
          String(a.id),
          a.title,
          a.url,
          String(a.risks),
          a.created,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const copy = [...filtered];
    copy.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return order === "newest" ? bTime - aTime : aTime - bTime;
    });
    return copy;
  }, [rows, search, order]);

  const articlePager = usePagination({
    items: visibleRows,
    pageSize: articlePageSize,
    resetKey: `${search}|${order}`,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadArticles();
    setRefreshing(false);
    toast.success("Articles list refreshed.", { autoClose: 2000 });
  }, [loadArticles]);

  const fieldId = (name: string) => `${baseId}-${name}`;

  return (
    <main className="mainLayout__content articlesPage">
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

      <section
        className="articlesPage__toolbar"
        aria-label="Article list controls"
      >
        <div className="articlesPage__toolbarLeft">
          <div className="articlesPage__field">
            <label htmlFor={fieldId("order")}>Order</label>
            <select
              id={fieldId("order")}
              value={order}
              onChange={(e) =>
                setOrder(e.target.value === "oldest" ? "oldest" : "newest")
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <button
            type="button"
            className="articlesPage__clearBtn"
            onClick={clearFilters}
            aria-label="Clear Filter"
            data-tooltip="Clear Filter"
          >
            <FilterX size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="usersPage__searchWrap articlesPage__searchWrap">
          <Search
            className="usersPage__searchIcon"
            size={18}
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            className="usersPage__searchInput"
            placeholder="Search title, URL, ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td className="articlesPage__td articlesPage__td--empty" colSpan={6}>
                      {search.trim()
                        ? "No articles match your search."
                        : loadState === "error"
                          ? "Could not load articles."
                          : "No articles to display."}
                    </td>
                  </tr>
                ) : (
                  articlePager.pageItems.map((row) => (
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
            page={articlePager.page}
            pageCount={articlePager.pageCount}
            total={articlePager.total}
            pageSize={articlePager.pageSize}
            from={articlePager.from}
            to={articlePager.to}
            onPageChange={articlePager.setPage}
            onPageSizeChange={setArticlePageSize}
          />
        </div>
      </section>
    </main>
  );
}
