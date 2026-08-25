import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { toast } from "react-toastify";

import { FilterX, RotateCw, Search } from "lucide-react";

import { readApiErrorMessage } from "../../../utils/readApiErrorMessage";
import { authFetch } from "../../../utils/authFetch";
import { formatDisplayDate } from "../../../utils/formatDate";

import { setDocumentPageTitle } from "../../../utils/pageTitle";

import { usePagination } from "../../../utils/usePagination";

import { PageHeader } from "../../Layout/PageHeader";

import { normalizeRisksFromApi, type RiskDetail } from "../Risk/riskData";
import { riskMatchesFilters } from "../Risk/riskListHelpers";

import { notifyPendingReviewCountChanged } from "../../../utils/reviewQueueEvents";

import { ReviewFeedbackDialog, type ReviewDialogMode } from "./ReviewFeedbackDialog";

import { DomainRemapDialog } from "./DomainRemapDialog";

import { ReviewFeedbackPanel } from "./ReviewFeedbackPanel";

import { ReviewRecordsTable } from "./ReviewRecordsTable";

import { REVIEW_WHY_LABELS } from "./reviewData";

import {
  normalizeReviewFeedbackFromApi,
  type ReviewFeedbackCounts,
  type ReviewFeedbackSample,
} from "./reviewFeedbackData";

import "../Users/usersPage.css";

import "../Risk/riskPage.css";

import "./reviewPage.css";



type ReviewTab = "queue" | "feedback"; // | "prompts"

// /** Placeholder until prompt versions are loaded from the API. */
// const MOCK_PROMPT_VERSIONS: { id: string }[] = [];



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

  // {

  //   id: "prompts",

  //   label: "Prompts",

  //   ariaLabel: (n) => `Prompts, ${n} version${n === 1 ? "" : "s"}`,

  // },

];



export function ReviewPage() {

  const baseId = useId();

  const [tab, setTab] = useState<ReviewTab>("queue");

  const [reviewSearch, setReviewSearch] = useState("");

  const [whyFilter, setWhyFilter] = useState("all");

  const [refreshing, setRefreshing] = useState(false);

  const [reviewPageSize, setReviewPageSize] = useState(10);

  const [rows, setRows] = useState<RiskDetail[]>([]);

  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(

    "idle",

  );

  const [actingId, setActingId] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<RiskDetail | null>(null);

  const [dialogMode, setDialogMode] = useState<ReviewDialogMode>("edit");

  const [editSubmitting, setEditSubmitting] = useState(false);

  const [domainTarget, setDomainTarget] = useState<RiskDetail | null>(null);

  const [taxonomyDomains, setTaxonomyDomains] = useState<string[]>([]);

  const [domainSubmitting, setDomainSubmitting] = useState(false);

  const [feedbackSamples, setFeedbackSamples] = useState<ReviewFeedbackSample[]>([]);

  const [feedbackCounts, setFeedbackCounts] = useState<ReviewFeedbackCounts>({
    raw: 0,
    structured: 0,
    total: 0,
  });

  const [feedbackLoadState, setFeedbackLoadState] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const fid = (name: string) => `${baseId}-${name}`;

  const loadReviewQueue = useCallback(async () => {
    const token = sessionStorage.getItem("accessToken");

    if (!token) {
      setRows([]);
      setLoadState("idle");
      return;
    }

    setLoadState("loading");
    try {
      const res = await authFetch("/risks/review-queue");

      if (!res.ok) {
        setLoadState("error");
        return;
      }

      const data = normalizeRisksFromApi(await res.json());

      setRows(
        data.risks.map((r) => {
          const createdAt = r.createdAt ?? r.ingestedAt;

          return {
            ...r,
            createdAt,
            ingestedAt: createdAt ? formatDisplayDate(createdAt) : "—",
          };
        }),
      );

      setLoadState("idle");
      notifyPendingReviewCountChanged();
    } catch {
      setLoadState("error");
    }
  }, []);

  const loadTaxonomyDomains = useCallback(async () => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try {
      const res = await authFetch("/risks/taxonomy-domains");
      if (!res.ok) return;
      const data = (await res.json()) as { domains?: string[] };
      setTaxonomyDomains(
        Array.isArray(data.domains)
          ? data.domains.filter((domain) => domain.trim())
          : [],
      );
    } catch {
      setTaxonomyDomains([]);
    }
  }, []);

  const loadFeedbackSamples = useCallback(async () => {
    const token = sessionStorage.getItem("accessToken");

    if (!token) {
      setFeedbackSamples([]);
      setFeedbackCounts({ raw: 0, structured: 0, total: 0 });
      setFeedbackLoadState("idle");
      return;
    }

    setFeedbackLoadState("loading");
    try {
      const res = await authFetch("/risks/review-feedback");

      if (!res.ok) {
        setFeedbackLoadState("error");
        return;
      }

      const data = normalizeReviewFeedbackFromApi(await res.json());

      setFeedbackSamples(data.items);
      setFeedbackCounts(data.counts);
      setFeedbackLoadState("idle");
    } catch {
      setFeedbackLoadState("error");
    }
  }, []);

  useEffect(() => {
    setDocumentPageTitle("Human Review");
  }, []);

  useEffect(() => {
    void loadFeedbackSamples();
  }, [loadFeedbackSamples]);

  useEffect(() => {
    void loadTaxonomyDomains();
  }, [loadTaxonomyDomains]);

  useEffect(() => {
    setReviewSearch("");
  }, [tab]);



  useEffect(() => {

    if (tab === "queue") {

      void loadReviewQueue();

    }

  }, [tab, loadReviewQueue]);



  useEffect(() => {

    if (tab === "feedback") {

      void loadFeedbackSamples();

    }

  }, [tab, loadFeedbackSamples]);



  const whyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const label = row.reviewWhy?.trim() || "Review";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const whyOptions = useMemo(() => {
    const extras = [...whyCounts.keys()].filter(
      (label) =>
        !(REVIEW_WHY_LABELS as readonly string[]).includes(label),
    );
    extras.sort((a, b) => a.localeCompare(b));
    return [...REVIEW_WHY_LABELS, ...extras];
  }, [whyCounts]);

  const queueRows = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const why = row.reviewWhy?.trim() || "Review";
      if (whyFilter !== "all" && why !== whyFilter) return false;
      if (!q) return true;
      if (riskMatchesFilters(row, "all", "all", reviewSearch)) return true;
      return [row.reviewWhy, row.reviewReason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, reviewSearch, whyFilter]);

  const pager = usePagination({

    items: queueRows,

    pageSize: reviewPageSize,

    resetKey: `${queueRows.length}|${reviewSearch}|${whyFilter}`,

  });



  const tabCounts = useMemo(

    (): Record<ReviewTab, number> => ({

      queue: rows.length,

      feedback: feedbackCounts.total,

      // prompts: MOCK_PROMPT_VERSIONS.length,

    }),

    [rows.length, feedbackCounts.total],

  );

  const feedbackSearchActive =
    tab === "feedback" && reviewSearch.trim().length > 0;



  const handleRefresh = useCallback(async () => {

    setRefreshing(true);

    if (tab === "queue") {

      await loadReviewQueue();

      setRefreshing(false);

      toast.success("Review queue refreshed.", { autoClose: 2000 });

      return;

    }

    if (tab === "feedback") {

      await loadFeedbackSamples();

      setRefreshing(false);

      toast.success("Feedback samples refreshed.", { autoClose: 2000 });

    }

  }, [loadReviewQueue, loadFeedbackSamples, tab]);



  const handleSubmitRaw = useCallback(

    async (feedback: string) => {

      if (!editTarget || editSubmitting) return;



      setEditSubmitting(true);

      try {

        const res = await authFetch(

          `/risks/${encodeURIComponent(editTarget.id)}/review/reject`,

          {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({ feedback, classification: "raw" }),

          },

        );

        const body = (await res.json().catch(() => ({}))) as { message?: string };



        if (!res.ok) {

          toast.error(

            readApiErrorMessage(body, "Could not save feedback. Try again."),

            { autoClose: 4000 },

          );

          return;

        }



        setEditTarget(null);

        await loadReviewQueue();

        await loadFeedbackSamples();

        notifyPendingReviewCountChanged();

        toast.success("Marked as Raw. Feedback saved.", {

          autoClose: 3000,

        });

      } catch {

        toast.error("Could not reach the server. Try again.", {

          autoClose: 4000,

        });

      } finally {

        setEditSubmitting(false);

      }

    },

    [editTarget, editSubmitting, loadReviewQueue, loadFeedbackSamples],

  );



  const handleSubmitStructured = useCallback(

    async (feedback: string) => {

      if (!editTarget || editSubmitting) return;



      setEditSubmitting(true);

      try {

        const res = await authFetch(

          `/risks/${encodeURIComponent(editTarget.id)}/review/classify`,

          {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({ feedback }),

          },

        );

        const body = (await res.json().catch(() => ({}))) as { message?: string };



        if (!res.ok) {

          toast.error(

            readApiErrorMessage(body, "Could not save as Structured. Try again."),

            { autoClose: 4000 },

          );

          return;

        }



        setEditTarget(null);

        await loadReviewQueue();

        await loadFeedbackSamples();

        notifyPendingReviewCountChanged();

        toast.success("Saved as Structured.", { autoClose: 3000 });

      } catch {

        toast.error("Could not reach the server. Try again.", {

          autoClose: 4000,

        });

      } finally {

        setEditSubmitting(false);

      }

    },

    [editTarget, editSubmitting, loadReviewQueue, loadFeedbackSamples],

  );



  const handleUpdateFeedback = useCallback(

    async (feedback: string) => {

      if (!editTarget || editSubmitting) return;



      setEditSubmitting(true);

      try {

        const res = await authFetch(

          `/risks/${encodeURIComponent(editTarget.id)}/review/feedback`,

          {

            method: "PATCH",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({ feedback }),

          },

        );

        const body = (await res.json().catch(() => ({}))) as { message?: string };



        if (!res.ok) {

          toast.error(

            readApiErrorMessage(body, "Could not update feedback. Try again."),

            { autoClose: 4000 },

          );

          return;

        }



        setEditTarget(null);

        await loadReviewQueue();

        await loadFeedbackSamples();

        toast.success("Feedback updated.", { autoClose: 3000 });

      } catch {

        toast.error("Could not reach the server. Try again.", {

          autoClose: 4000,

        });

      } finally {

        setEditSubmitting(false);

      }

    },

    [editTarget, editSubmitting, loadReviewQueue, loadFeedbackSamples],

  );



  const handleMoveToRisks = useCallback(

    async (
      feedback: string,
      classification: "raw" | "structured",
      domain?: string,
    ) => {

      if (!editTarget || editSubmitting) return;



      setActingId(editTarget.id);

      setEditSubmitting(true);

      try {

        const res = await authFetch(

          `/risks/${encodeURIComponent(editTarget.id)}/review/approve`,

          {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({ classification, feedback, domain }),

          },

        );

        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          toast.error(
            readApiErrorMessage(body, "Could not move this risk. Try again."),
            { autoClose: 4000 },
          );
          return;
        }

        setEditTarget(null);
        await loadReviewQueue();

        await loadFeedbackSamples();

        notifyPendingReviewCountChanged();

        toast.success("Moved to Risks.", {
          autoClose: 3000,
        });

      } catch {

        toast.error("Could not reach the server. Try again.", {

          autoClose: 4000,

        });

      } finally {

        setActingId(null);

        setEditSubmitting(false);

      }

    },

    [editTarget, editSubmitting, loadReviewQueue, loadFeedbackSamples],

  );

  const handleRemapDomain = useCallback(
    async (domain: string) => {
      if (!domainTarget || domainSubmitting) return;
      setDomainSubmitting(true);
      setActingId(domainTarget.id);
      try {
        const res = await authFetch(
          `/risks/${encodeURIComponent(domainTarget.id)}/review/domain`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain }),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(
            readApiErrorMessage(body, "Could not update the domain. Try again."),
            { autoClose: 4000 },
          );
          return;
        }
        setDomainTarget(null);
        await loadReviewQueue();
        notifyPendingReviewCountChanged();
        toast.success("Domain updated.", { autoClose: 3000 });
      } catch {
        toast.error("Could not reach the server. Try again.", { autoClose: 4000 });
      } finally {
        setActingId(null);
        setDomainSubmitting(false);
      }
    },
    [domainTarget, domainSubmitting, loadReviewQueue],
  );

  const handlePromoteClassifiedToRisks = useCallback(

    async (input: {
      id: string;
      feedback?: string | null;
      classification?: "raw" | "structured";
    }) => {

      if (actingId || editSubmitting) return;



      setActingId(input.id);

      try {

        const res = await authFetch(

          `/risks/${encodeURIComponent(input.id)}/review/approve`,

          {

            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({

              classification: input.classification ?? "structured",

              feedback: input.feedback ?? "",

            }),

          },

        );

        const body = await res.json().catch(() => ({}));

        if (!res.ok) {

          toast.error(

            readApiErrorMessage(body, "Could not move this risk. Try again."),

            { autoClose: 4000 },

          );

          return;

        }



        await loadReviewQueue();

        await loadFeedbackSamples();

        notifyPendingReviewCountChanged();

        toast.success("Moved to Risks.", { autoClose: 3000 });

      } catch {

        toast.error("Could not reach the server. Try again.", {

          autoClose: 4000,

        });

      } finally {

        setActingId(null);

      }

    },

    [actingId, editSubmitting, loadReviewQueue, loadFeedbackSamples],

  );



  const searchPlaceholder =
    tab === "queue" ? "Search review queue…" : "Search feedback samples…";

  const searchAriaLabel =
    tab === "queue" ? "Search review queue" : "Search feedback samples";

  const hasQueueFilters =
    tab === "queue" && (whyFilter !== "all" || Boolean(reviewSearch.trim()));

  const clearQueueFilters = () => {
    setWhyFilter("all");
    setReviewSearch("");
  };



  return (

    <main className="mainLayout__content reviewPage usersPage riskPage">

      <PageHeader

        title="Human Review"

        subtitle="Review each extraction as Raw or Structured, or explicitly move it to Risks."

        actions={

          <button

            type="button"

            className="usersPage__inviteBtn"

            onClick={() => void handleRefresh()}

            disabled={refreshing}

            aria-busy={refreshing}

            aria-label={

              tab === "queue" ? "Refresh review queue" : "Refresh feedback samples"

            }

          >

            <RotateCw

              size={18}

              strokeWidth={2}

              className={refreshing ? "pageHeader__refreshIcon--spin" : undefined}

              aria-hidden

            />

            Refresh

          </button>

        }

      />



      <div className="usersPage__toolbar reviewPage__toolbar">

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

        <div className="reviewPage__toolbarActions">
          {tab === "queue" ? (
            <select
              id={fid("why")}
              className="reviewPage__whySelect"
              value={whyFilter}
              onChange={(e) => setWhyFilter(e.target.value)}
              aria-label="Filter review queue by why"
            >
              <option value="all">All</option>
              {whyOptions.map((label) => (
                <option key={label} value={label}>
                  {label} ({whyCounts.get(label) ?? 0})
                </option>
              ))}
            </select>
          ) : null}
          {tab === "queue" ? (
            <button
              type="button"
              className="riskPage__clearBtn"
              onClick={clearQueueFilters}
              disabled={!hasQueueFilters}
              aria-label="Clear Filter"
              data-tooltip="Clear Filter"
            >
              <FilterX size={18} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
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

      </div>



      {tab === "queue" ? (

        <section

          className="reviewPage__panel reviewPage__panel--queue"

          role="tabpanel"

          id={fid("panel-queue")}

          aria-labelledby={fid("tab-queue")}

        >

          <ReviewRecordsTable

            rows={pager.pageItems}

            loadState={loadState}

            page={pager.page}

            pageCount={pager.pageCount}

            total={pager.total}

            pageSize={pager.pageSize}

            from={pager.from}

            to={pager.to}

            onPageChange={pager.setPage}

            onPageSizeChange={setReviewPageSize}

            actingId={actingId}

            onView={(row) => {
              setDialogMode("view");
              setEditTarget(row);
            }}

            onEdit={(row) => {
              setDialogMode("edit");
              setEditTarget(row);
            }}
            onEditDomain={(row) => {
              setDomainTarget(row);
            }}

            emptyMessage={
              reviewSearch.trim() || whyFilter !== "all"
                ? "No review items match your filters."
                : "No items in the review queue."
            }

          />

        </section>

      ) : null}



      {tab === "feedback" ? (

        <section

          className="reviewPage__panel reviewPage__panel--feedback"

          role="tabpanel"

          id={fid("panel-feedback")}

          aria-labelledby={fid("tab-feedback")}

        >

          <ReviewFeedbackPanel

            idPrefix={fid("feedback")}

            samples={feedbackSamples}

            counts={feedbackCounts}

            loadState={feedbackLoadState}

            searchQuery={feedbackSearchActive ? reviewSearch : ""}

            promotingId={actingId}

            onMoveToRisks={(item) =>
              void handlePromoteClassifiedToRisks({
                id: item.id,
                feedback: item.feedback,
                classification: item.classification,
              })
            }

          />

        </section>

      ) : null}



      {/* {tab === "prompts" ? (

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

      ) : null} */}



      <ReviewFeedbackDialog

        open={editTarget != null}

        mode={dialogMode}

        riskTitle={editTarget?.title ?? "this item"}

        reviewWhy={editTarget?.reviewWhy}

        reviewReason={editTarget?.reviewReason}

        currentDomain={editTarget?.domain ?? ""}

        taxonomyDomains={taxonomyDomains}

        submitting={editSubmitting}

        initialReview={editTarget?.humanReview}

        onClose={() => {

          if (!editSubmitting) setEditTarget(null);

        }}

        onSubmitRaw={(feedback) => void handleSubmitRaw(feedback)}

        onSubmitStructured={(feedback) => void handleSubmitStructured(feedback)}

        onUpdateFeedback={(feedback) => void handleUpdateFeedback(feedback)}

        onMoveToRisks={(feedback, classification, domain) =>
          void handleMoveToRisks(feedback, classification, domain)
        }

      />

      <DomainRemapDialog
        open={domainTarget != null}
        riskTitle={domainTarget?.title ?? "this item"}
        currentDomain={domainTarget?.domain ?? ""}
        taxonomyDomains={taxonomyDomains}
        submitting={domainSubmitting}
        onClose={() => {
          if (!domainSubmitting) setDomainTarget(null);
        }}
        onSave={(domain) => void handleRemapDomain(domain)}
      />

    </main>

  );

}


