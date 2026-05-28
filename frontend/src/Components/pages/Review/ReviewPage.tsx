import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Check, ChevronDown, Eye, Pencil, RotateCw, Search, X } from "lucide-react";
import { authFetch } from "../../../utils/authFetch";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { PageHeader } from "../../Layout/PageHeader";
import "../Users/usersPage.css";
import {
  normalizeReviewQueueFromApi,
  type ReviewQueueItem,
} from "./reviewData";
import "./reviewPage.css";

type ReviewTab = "queue" | "feedback" | "prompts";

type FeedbackSampleView = "raw" | "structured";

/** Placeholder until feedback samples are loaded from the API. */
const MOCK_FEEDBACK_SAMPLES: { id: string }[] = [];

/** Placeholder until prompt versions are loaded from the API. */
const MOCK_PROMPT_VERSIONS: { id: string }[] = [];

type ReviewTabMeta = {
  id: ReviewTab;
  label: string;
  ariaLabel: (n: number) => string;
};

const REVIEW_TAB_METAS: readonly ReviewTabMeta[] = [
  {
    id: "queue",
    label: "Review Queue",
    ariaLabel: (n) => `Queue, ${n} item${n === 1 ? "" : "s"}`,
  },
  {
    id: "feedback",
    label: "Feedback",
    ariaLabel: (n) => `Feedback, ${n} sample${n === 1 ? "" : "s"}`,
  },
  {
    id: "prompts",
    label: "Prompts",
    ariaLabel: (n) => `Prompts, ${n} version${n === 1 ? "" : "s"}`,
  },
];

const FEEDBACK_VIEW_OPTIONS: { value: FeedbackSampleView; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "structured", label: "Structured" },
];

export function ReviewPage() {
  const navigate = useNavigate();
  const baseId = useId();
  const [tab, setTab] = useState<ReviewTab>("queue");
  const [feedbackView, setFeedbackView] = useState<FeedbackSampleView>("raw");
  const [headerRefreshing, setHeaderRefreshing] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [queueLoadState, setQueueLoadState] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    setDocumentPageTitle("Human Review");
  }, []);

  const fid = (name: string) => `${baseId}-${name}`;

  const stub = useCallback((action: string) => {
    toast.info(`${action} is not wired to the API yet.`, { autoClose: 2800 });
  }, []);

  const loadReviewQueue = useCallback(async () => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      setQueue([]);
      setQueueLoadState("idle");
      return;
    }

    setQueueLoadState("loading");
    try {
      const res = await authFetch("/risks/review-queue");
      if (!res.ok) {
        setQueueLoadState("error");
        return;
      }
      const data = normalizeReviewQueueFromApi(await res.json());
      setQueue(data.items);
      setQueueLoadState("idle");
    } catch {
      setQueueLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (tab === "queue") {
      void loadReviewQueue();
    }
  }, [tab, loadReviewQueue]);

  const handleHeaderRefresh = useCallback(async () => {
    setHeaderRefreshing(true);
    if (tab === "queue") {
      await loadReviewQueue();
      setHeaderRefreshing(false);
      toast.success("Review queue refreshed.", { autoClose: 2000 });
      return;
    }
    setHeaderRefreshing(false);
    if (tab === "feedback") {
      stub("Refresh feedback samples");
      return;
    }
    stub("Refresh prompt versions");
  }, [loadReviewQueue, stub, tab]);

  const filteredQueue = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.domain.toLowerCase().includes(q) ||
        item.displayId.toLowerCase().includes(q) ||
        item.reviewReason.toLowerCase().includes(q),
    );
  }, [queue, reviewSearch]);

  const tabCounts = useMemo(
    (): Record<ReviewTab, number> => ({
      queue: queue.length,
      feedback: MOCK_FEEDBACK_SAMPLES.length,
      prompts: MOCK_PROMPT_VERSIONS.length,
    }),
    [queue.length],
  );

  const searchPlaceholder =
    tab === "queue"
      ? "Search queue by title, domain, ID…"
      : tab === "feedback"
        ? "Search feedback samples…"
        : "Search prompt versions…";

  const searchAriaLabel =
    tab === "queue"
      ? "Search review queue"
      : tab === "feedback"
        ? "Search feedback samples"
        : "Search prompt versions";

  const openRisk = useCallback(
    (item: ReviewQueueItem) => {
      const id = item.displayId || item.id;
      navigate(`/risk/${encodeURIComponent(id)}?tab=analysis`);
    },
    [navigate],
  );

  const handleApprove = useCallback(
    async (item: ReviewQueueItem) => {
      if (approvingId) return;

      setApprovingId(item.id);
      try {
        const res = await authFetch(
          `/risks/${encodeURIComponent(item.id)}/review/approve`,
          { method: "POST" },
        );
        const body = (await res.json().catch(() => ({}))) as {
          catalogRiskId?: string;
          message?: string;
        };

        if (!res.ok) {
          toast.error(
            body.message ?? "Could not approve this risk. Try again.",
            { autoClose: 4000 },
          );
          return;
        }

        setQueue((prev) => prev.filter((row) => row.id !== item.id));
        toast.success(
          `Added to catalog as ${body.catalogRiskId ?? "new mapping"}.`,
          { autoClose: 3000 },
        );
      } catch {
        toast.error("Could not reach the server. Try again.", {
          autoClose: 4000,
        });
      } finally {
        setApprovingId(null);
      }
    },
    [approvingId],
  );

  return (
    <main className="mainLayout__content reviewPage usersPage">
      <PageHeader
        title="Human Review"
        subtitle="Risks with domains that do not map to the risk_mappings catalog appear here for manual review."
        actions={
          <button
            type="button"
            className="usersPage__inviteBtn"
            onClick={() => void handleHeaderRefresh()}
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
              className={headerRefreshing ? "pageHeader__refreshIcon--spin" : undefined}
              aria-hidden
            />
            Refresh
          </button>
        }
      />

      <div className="usersPage__toolbar">
        <div className="usersPage__tabs" role="tablist" aria-label="Human review sections">
          {REVIEW_TAB_METAS.map(({ id, label, ariaLabel }) => {
            const selected = tab === id;
            const count = tabCounts[id];
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
          {queueLoadState === "loading" ? (
            <p className="reviewPage__panelHint">Loading review queue…</p>
          ) : queueLoadState === "error" ? (
            <p className="reviewPage__panelHint">
              Could not load the review queue. Try refreshing.
            </p>
          ) : filteredQueue.length === 0 ? (
            <p className="reviewPage__panelHint">
              {queue.length === 0
                ? "No risks need domain review — all extracted domains map to the catalog."
                : "No queue items match your search."}
            </p>
          ) : (
            filteredQueue.map((item) => (
              <article key={item.id} className="reviewPage__card">
                <div className="reviewPage__cardMain">
                  <div className="reviewPage__cardMeta">
                    <span className="reviewPage__id">{item.displayId}</span>
                    <span className="reviewPage__pill reviewPage__pill--score">
                      {item.scoreLabel}
                    </span>
                    <span className="reviewPage__pill reviewPage__pill--priority">
                      {item.priority}
                    </span>
                  </div>
                  <h2 className="reviewPage__cardTitle">{item.title}</h2>
                  <p className="reviewPage__cardCategory">{item.category}</p>
                  <p className="reviewPage__cardReason">{item.reviewReason}</p>
                </div>
                <div className="reviewPage__actions">
                  <button
                    type="button"
                    className="reviewPage__actionBtn reviewPage__actionBtn--view"
                    onClick={() => openRisk(item)}
                  >
                    <Eye size={14} strokeWidth={2} aria-hidden />
                    View
                  </button>
                  <button
                    type="button"
                    className="reviewPage__actionBtn reviewPage__actionBtn--approve"
                    disabled={approvingId === item.id}
                    aria-busy={approvingId === item.id}
                    onClick={() => void handleApprove(item)}
                  >
                    <Check size={14} strokeWidth={2.5} aria-hidden />
                    {approvingId === item.id ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="reviewPage__actionBtn reviewPage__actionBtn--correct"
                    onClick={() => openRisk(item)}
                  >
                    <Pencil size={14} strokeWidth={2} aria-hidden />
                    Correct
                  </button>
                  <button
                    type="button"
                    className="reviewPage__actionBtn reviewPage__actionBtn--reject"
                    onClick={() => stub(`Reject ${item.displayId}`)}
                  >
                    <X size={14} strokeWidth={2.5} aria-hidden />
                    Reject
                  </button>
                  <button
                    type="button"
                    className="reviewPage__moreBtn"
                    aria-label={`More actions for ${item.displayId}`}
                    onClick={() => stub(`More options ${item.displayId}`)}
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
