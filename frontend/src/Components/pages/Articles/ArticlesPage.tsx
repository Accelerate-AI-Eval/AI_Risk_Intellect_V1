import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ExternalLink, FileText, RefreshCw, Search, Shield } from "lucide-react";
import { PageHeading } from "../../Layout/PageHeading";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import "../Users/usersPage.css";
import "./articlesPage.css";

type ArticleRow = {
  id: string;
  title: string;
  url: string;
  risks: number;
  created: string;
};

/** Demo rows until articles API exists. */
const MOCK_ARTICLES: ArticleRow[] = [
  {
    id: "1001",
    title: "Market brief: AI risk signals and sector watch",
    url: "https://feeds.example.com/articles/1",
    risks: 0,
    created: "May 12, 2025",
  },
  {
    id: "1002",
    title: "Regulatory roundup: model documentation expectations",
    url: "https://feeds.example.com/articles/2",
    risks: 0,
    created: "May 10, 2025",
  },
];

const HARDCODED_TOTAL = 126;
const HARDCODED_RISKS_EXTRACTED = 0;
const HARDCODED_AVG_RISKS = "0.0";

export function ArticlesPage() {
  const baseId = useId();
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setDocumentPageTitle("Articles");
  }, []);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = MOCK_ARTICLES;
    if (q) {
      rows = MOCK_ARTICLES.filter((a) => {
        const hay = [a.id, a.title, a.url, String(a.risks), a.created]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const copy = [...rows];
    copy.sort((a, b) =>
      order === "newest"
        ? Number(b.id) - Number(a.id)
        : Number(a.id) - Number(b.id),
    );
    return copy;
  }, [search, order]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      toast.success("Articles list refreshed.", { autoClose: 2000 });
    }, 650);
  }, []);

  const fieldId = (name: string) => `${baseId}-${name}`;

  return (
    <main className="mainLayout__content articlesPage">
      <header className="articlesPage__header">
        <div className="articlesPage__headerText">
          <PageHeading className="articlesPage__title">Articles</PageHeading>
          <p className="articlesPage__subtitle">
            Source articles and documents.
          </p>
        </div>
        <button
          type="button"
          className="usersPage__inviteBtn"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          <RefreshCw
            size={18}
            strokeWidth={2}
            className={refreshing ? "articlesPage__refreshIcon--spin" : undefined}
            aria-hidden
          />
          Refresh
        </button>
      </header>

      <div className="articlesPage__metrics">
        <article className="articlesPage__metric articlesPage__metric--total">
          <div className="articlesPage__metricInner">
            <div className="articlesPage__metricCopy">
              <p className="articlesPage__metricLabel">Total articles</p>
              <p className="articlesPage__metricValue">{HARDCODED_TOTAL}</p>
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
              <p className="articlesPage__metricValue">{HARDCODED_RISKS_EXTRACTED}</p>
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
                {HARDCODED_AVG_RISKS}
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
                {visibleRows.length === 0 ? (
                  <tr>
                    <td className="articlesPage__td articlesPage__td--empty" colSpan={6}>
                      {search.trim()
                        ? "No articles match your search."
                        : "No articles to display."}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
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
        </div>
      </section>
    </main>
  );
}
