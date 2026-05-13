import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Check, ChevronDown, Pencil, RotateCw, Search, X } from "lucide-react";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { PageHeading } from "../../Layout/PageHeading";
import "../Users/usersPage.css";
import "./reviewPage.css";

type ReviewTab = "queue" | "feedback" | "prompts";

type FeedbackSampleView = "raw" | "structured";

type QueueItem = {
  id: string;
  scoreLabel: string;
  priority: "Low" | "Medium" | "High";
  title: string;
  category: string;
};

const QUEUE_COUNT = 1152;

const MOCK_QUEUE: QueueItem[] = [
  {
    id: "#49",
    scoreLabel: "0/100",
    priority: "Medium",
    title: "Failed Risk Extraction",
    category: "Technical Risks 7. AI System Safety, Failures, & Limitations",
  },
  {
    id: "#50",
    scoreLabel: "42/100",
    priority: "High",
    title: "Ambiguous regulatory mention",
    category: "Compliance Risks 3. Governance & Accountability",
  },
  {
    id: "#51",
    scoreLabel: "88/100",
    priority: "Low",
    title: "Minor wording variance",
    category: "Operational Risks 5. Third-Party & Vendor Risk",
  },
];

const FEEDBACK_SAMPLE_COUNT = 0;
const PROMPT_VERSION_COUNT = 0;

type ReviewTabDef = {
  id: ReviewTab;
  label: string;
  count: number;
  ariaLabel: (n: number) => string;
};

const REVIEW_TAB_DEFS: readonly ReviewTabDef[] = [
  {
    id: "queue",
    label: "Queue",
    count: QUEUE_COUNT,
    ariaLabel: (n) => `Queue, ${n} item${n === 1 ? "" : "s"}`,
  },
  {
    id: "feedback",
    label: "Feedback",
    count: FEEDBACK_SAMPLE_COUNT,
    ariaLabel: (n) => `Feedback, ${n} sample${n === 1 ? "" : "s"}`,
  },
  {
    id: "prompts",
    label: "Prompts",
    count: PROMPT_VERSION_COUNT,
    ariaLabel: (n) => `Prompts, ${n} version${n === 1 ? "" : "s"}`,
  },
];

const FEEDBACK_VIEW_OPTIONS: { value: FeedbackSampleView; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "structured", label: "Structured" },
];

export function ReviewPage() {
  const baseId = useId();
  const [tab, setTab] = useState<ReviewTab>("queue");
  const [feedbackView, setFeedbackView] = useState<FeedbackSampleView>("raw");
  const [headerRefreshing, setHeaderRefreshing] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");

  useEffect(() => {
    setDocumentPageTitle("Human Review");
  }, []);

  const fid = (name: string) => `${baseId}-${name}`;

  const stub = useCallback((action: string) => {
    toast.info(`${action} is not wired to the API yet.`, { autoClose: 2800 });
  }, []);

  const handleHeaderRefresh = useCallback(() => {
    setHeaderRefreshing(true);
    window.setTimeout(() => {
      setHeaderRefreshing(false);
      if (tab === "queue") {
        toast.success("Review queue refreshed.", { autoClose: 2000 });
        return;
      }
      if (tab === "feedback") {
        stub("Refresh feedback samples");
        return;
      }
      stub("Refresh prompt versions");
    }, 650);
  }, [stub, tab]);

  const filteredQueue = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    if (!q) return MOCK_QUEUE;
    return MOCK_QUEUE.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q),
    );
  }, [reviewSearch]);

  const searchPlaceholder =
    tab === "queue"
      ? "Search queue by title, category, ID…"
      : tab === "feedback"
        ? "Search feedback samples…"
        : "Search prompt versions…";

  const searchAriaLabel =
    tab === "queue"
      ? "Search review queue"
      : tab === "feedback"
        ? "Search feedback samples"
        : "Search prompt versions";

  return (
    <main className="mainLayout__content reviewPage usersPage">
      <header className="reviewPage__header">
        <div className="reviewPage__headerText">
          <PageHeading className="reviewPage__title">Human Review</PageHeading>
          <p className="reviewPage__subtitle" id={fid("subtitle")}>
            Verify LLM extractions, curate feedback samples, and manage prompt versions.
          </p>
        </div>
        <button
          type="button"
          className="usersPage__inviteBtn"
          onClick={handleHeaderRefresh}
          disabled={headerRefreshing}
          aria-busy={headerRefreshing}
          aria-label={
            tab === "queue"
              ? "Refresh review queue"
              : tab === "feedback"
                ? "Refresh feedback samples"
                : "Refresh prompt versions"
          }
        >
          <RotateCw
            size={18}
            strokeWidth={2}
            className={headerRefreshing ? "reviewPage__refreshIcon--spin" : undefined}
            aria-hidden
          />
          Refresh
        </button>
      </header>

      <div className="usersPage__toolbar">
        <div className="usersPage__tabs" role="tablist" aria-label="Human review sections">
          {REVIEW_TAB_DEFS.map(({ id, label, count, ariaLabel }) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={fid(`tab-${id}`)}
                aria-selected={selected}
                aria-controls={fid(`panel-${id}`)}
                tabIndex={selected ? 0 : -1}
                aria-label={ariaLabel(count)}
                className={`usersPage__tab${selected ? " usersPage__tab--selected" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
                <span className="usersPage__tabCount" aria-hidden>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="usersPage__searchWrap">
          <Search className="usersPage__searchIcon" size={18} strokeWidth={2} aria-hidden />
          <input
            id={fid("review-search")}
            type="search"
            className="usersPage__searchInput"
            placeholder={searchPlaceholder}
            value={reviewSearch}
            onChange={(e) => setReviewSearch(e.target.value)}
            aria-label={searchAriaLabel}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
      </div>

      {tab === "queue" ? (
        <section
          className="reviewPage__panel"
          role="tabpanel"
          id={fid("panel-queue")}
          aria-labelledby={fid("tab-queue")}
        >
          {filteredQueue.length === 0 ? (
            <p className="reviewPage__panelHint">No queue items match your search.</p>
          ) : (
            filteredQueue.map((item) => (
            <article key={item.id} className="reviewPage__card">
              <div className="reviewPage__cardMain">
                <div className="reviewPage__cardMeta">
                  <span className="reviewPage__id">{item.id}</span>
                  <span className="reviewPage__pill reviewPage__pill--score">
                    {item.scoreLabel}
                  </span>
                  <span className="reviewPage__pill reviewPage__pill--priority">
                    {item.priority}
                  </span>
                </div>
                <h2 className="reviewPage__cardTitle">{item.title}</h2>
                <p className="reviewPage__cardCategory">{item.category}</p>
              </div>
              <div className="reviewPage__actions">
                <button
                  type="button"
                  className="reviewPage__actionBtn reviewPage__actionBtn--approve"
                  onClick={() => stub(`Approve ${item.id}`)}
                >
                  <Check size={14} strokeWidth={2.5} aria-hidden />
                  Approve
                </button>
                <button
                  type="button"
                  className="reviewPage__actionBtn reviewPage__actionBtn--correct"
                  onClick={() => stub(`Correct ${item.id}`)}
                >
                  <Pencil size={14} strokeWidth={2} aria-hidden />
                  Correct
                </button>
                <button
                  type="button"
                  className="reviewPage__actionBtn reviewPage__actionBtn--reject"
                  onClick={() => stub(`Reject ${item.id}`)}
                >
                  <X size={14} strokeWidth={2.5} aria-hidden />
                  Reject
                </button>
                <button
                  type="button"
                  className="reviewPage__moreBtn"
                  aria-label={`More actions for ${item.id}`}
                  onClick={() => stub(`More options ${item.id}`)}
                >
                  <ChevronDown size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "feedback" ? (
        <section
          className="reviewPage__panel reviewPage__panel--feedback"
          role="tabpanel"
          id={fid("panel-feedback")}
          aria-labelledby={fid("tab-feedback")}
        >
          <div className="reviewPage__feedbackToolbar">
            <div className="reviewPage__feedbackSelectWrap">
              <label htmlFor={fid("feedback-view")} className="reviewPage__visuallyHidden">
                Sample view
              </label>
              <select
                id={fid("feedback-view")}
                className="reviewPage__feedbackSelect"
                value={feedbackView}
                onChange={(e) => setFeedbackView(e.target.value as FeedbackSampleView)}
              >
                {FEEDBACK_VIEW_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="reviewPage__feedbackSelectChevron"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
            </div>
          </div>
          <p className="reviewPage__panelHint">
            Curated examples from reviewer corrections will appear here for model tuning.
          </p>
        </section>
      ) : null}

      {tab === "prompts" ? (
        <section
          className="reviewPage__panel"
          role="tabpanel"
          id={fid("panel-prompts")}
          aria-labelledby={fid("tab-prompts")}
        >
          <p className="reviewPage__panelHint">
            Track prompt versions, compare outputs, and roll back when extraction quality
            regresses.
          </p>
        </section>
      ) : null}
    </main>
  );
}
