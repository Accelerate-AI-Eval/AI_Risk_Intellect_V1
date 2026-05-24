import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "react-toastify";
import { CircleX, Link2, Play, X } from "lucide-react";
import { authFetch } from "../../utils/authFetch";
import "../pages/Users/usersPage.css";

export type UrlIngestionDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Called after a URL is successfully enqueued (e.g. refresh job list). */
  onEnqueued?: () => void;
};

export function UrlIngestionDialog({
  open,
  onClose,
  onEnqueued,
}: UrlIngestionDialogProps) {
  const baseId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [ingestUrl, setIngestUrl] = useState("");
  const [enqueueing, setEnqueueing] = useState(false);

  const close = useCallback(() => {
    if (enqueueing) return;
    setIngestUrl("");
    onClose();
  }, [enqueueing, onClose]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLInputElement>("input[type=url]")?.focus();
  }, [open]);

  const handleEnqueue = useCallback(async () => {
    const url = ingestUrl.trim();
    if (!url) {
      toast.error("Enter a URL to enqueue.", { autoClose: 2500 });
      return;
    }

    setEnqueueing(true);
    try {
      const res = await authFetch("/admin/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        message?: string;
      };

      if (res.status === 201) {
        toast.success(data.message ?? "URL enqueued for risk extraction.", {
          autoClose: 3000,
        });
        setIngestUrl("");
        onEnqueued?.();
        onClose();
        return;
      }

      if (res.status === 409) {
        toast.warning(
          data.error?.message ?? "This URL is already present.",
          { autoClose: 3500 },
        );
        return;
      }

      toast.error(
        data.error?.message ?? "Could not add this URL. Please try again.",
        { autoClose: 4000 },
      );
    } catch {
      toast.error("Network error while enqueueing URL.", { autoClose: 3000 });
    } finally {
      setEnqueueing(false);
    }
  }, [ingestUrl, onClose, onEnqueued]);

  if (!open) return null;

  const titleId = `${baseId}-ingest-title`;
  const urlId = `${baseId}-ingest-url`;

  return (
    <div
      className="usersPage__overlay"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className="usersPage__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="usersPage__dialogHead">
          <h2 id={titleId} className="usersPage__dialogTitle">
            URL ingestion
          </h2>
          <button
            type="button"
            className="usersPage__dialogClose"
            onClick={close}
            disabled={enqueueing}
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="usersPage__dialogBody">
          <p className="mainLayout__pageHint" style={{ margin: 0 }}>
            Manually queue a URL for risk extraction.
          </p>
          <label className="usersPage__label usersPage__label--withIcon" htmlFor={urlId}>
            <Link2 className="usersPage__labelIcon" size={16} strokeWidth={2} aria-hidden />
            <span>URL</span>
          </label>
          <input
            id={urlId}
            type="url"
            className="usersPage__input"
            placeholder="https://example.com/article"
            value={ingestUrl}
            onChange={(e) => setIngestUrl(e.target.value)}
            autoComplete="off"
            disabled={enqueueing}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleEnqueue();
              }
            }}
          />
          <div className="usersPage__dialogActions">
            <button
              type="button"
              className="usersPage__btn usersPage__btn--logoutTone"
              onClick={close}
              disabled={enqueueing}
            >
              <CircleX size={16} strokeWidth={1.75} aria-hidden />
              Cancel
            </button>
            <button
              type="button"
              className="usersPage__btn usersPage__btn--primary usersPage__btn--inviteSend"
              onClick={() => void handleEnqueue()}
              disabled={enqueueing}
            >
              <Play size={16} strokeWidth={2} aria-hidden />
              {enqueueing ? "Enqueueing…" : "Enqueue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
