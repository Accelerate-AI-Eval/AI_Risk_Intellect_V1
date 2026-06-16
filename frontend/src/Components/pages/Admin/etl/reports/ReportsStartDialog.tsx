import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, CircleX, Play, X } from "lucide-react";
import {
  fetchEtlReportUploadItems,
  type EtlReportUploadItemRow,
  type EtlReportUploadRow,
} from "../../../../../utils/etlReportsApi";
import "../../../Users/usersPage.css";
import "../../adminRssFeeds.css";

export type ReportsStartDialogProps = {
  open: boolean;
  uploads: EtlReportUploadRow[];
  uploadsLoading?: boolean;
  starting?: boolean;
  onClose: () => void;
  onStart: (selection: {
    uploadIds: number[];
    reportIds: number[];
  }) => void;
};

function itemCountForUpload(row: EtlReportUploadRow): number {
  return row.importedRows;
}

export function ReportsStartDialog({
  open,
  uploads,
  uploadsLoading = false,
  starting = false,
  onClose,
  onStart,
}: ReportsStartDialogProps) {
  const baseId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selectedReportIds, setSelectedReportIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsByUploadId, setItemsByUploadId] = useState<
    Record<number, EtlReportUploadItemRow[]>
  >({});
  const [expandedUploadIds, setExpandedUploadIds] = useState<Set<number>>(
    () => new Set(),
  );

  const eligibleUploads = useMemo(
    () =>
      uploads.filter(
        (upload) =>
          upload.status === "completed" && itemCountForUpload(upload) > 0,
      ),
    [uploads],
  );

  const allItems = useMemo(
    () => Object.values(itemsByUploadId).flat(),
    [itemsByUploadId],
  );
  const allIds = useMemo(() => allItems.map((item) => item.id), [allItems]);
  const itemUploadById = useMemo(
    () => new Map(allItems.map((item) => [item.id, item.uploadId])),
    [allItems],
  );
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedReportIds.has(id));
  const someSelected = allIds.some((id) => selectedReportIds.has(id));
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || uploadsLoading) return;
    let cancelled = false;
    setItemsLoading(true);
    setItemsByUploadId({});
    setSelectedReportIds(new Set());
    setExpandedUploadIds(new Set());

    if (eligibleUploads.length === 0) {
      setItemsLoading(false);
      return;
    }

    void Promise.all(
      eligibleUploads.map(async (upload) => {
        const result = await fetchEtlReportUploadItems(upload.id);
        return {
          uploadId: upload.id,
          items: result.ok ? result.items : [],
        };
      }),
    )
      .then((rows) => {
        if (cancelled) return;
        const next: Record<number, EtlReportUploadItemRow[]> = {};
        const selected = new Set<number>();
        for (const row of rows) {
          next[row.uploadId] = row.items;
          for (const item of row.items) {
            selected.add(item.id);
          }
        }
        setItemsByUploadId(next);
        setSelectedReportIds(selected);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, uploadsLoading, eligibleUploads]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const close = useCallback(() => {
    if (starting) return;
    onClose();
  }, [onClose, starting]);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedReportIds(checked ? new Set(allIds) : new Set());
    },
    [allIds],
  );

  const toggleOne = useCallback((id: number, checked: boolean) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleUpload = useCallback(
    (uploadId: number, checked: boolean) => {
      const uploadItems = itemsByUploadId[uploadId] ?? [];
      const uploadItemIds = uploadItems.map((item) => item.id);
      setSelectedReportIds((prev) => {
        const next = new Set(prev);
        for (const id of uploadItemIds) {
          if (checked) {
            next.add(id);
          } else {
            next.delete(id);
          }
        }
        return next;
      });
    },
    [itemsByUploadId],
  );

  const toggleUploadExpanded = useCallback((uploadId: number) => {
    setExpandedUploadIds((prev) => {
      const next = new Set(prev);
      if (next.has(uploadId)) next.delete(uploadId);
      else next.add(uploadId);
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    if (selectedReportIds.size === 0) return;
    const reportIds = [...selectedReportIds];
    const uploadIds = [
      ...new Set(
        reportIds
          .map((id) => itemUploadById.get(id))
          .filter((id): id is number => typeof id === "number"),
      ),
    ];
    onStart({ uploadIds, reportIds });
  }, [onStart, selectedReportIds, itemUploadById]);

  if (!open) return null;

  const titleId = `${baseId}-reports-start-title`;

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
        className="usersPage__dialog adminPage__discoveryDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="usersPage__dialogHead">
          <h2 id={titleId} className="usersPage__dialogTitle">
            Start reports worker
          </h2>
          <button
            type="button"
            className="usersPage__dialogClose"
            onClick={close}
            disabled={starting}
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="usersPage__dialogBody">
          <p className="adminPage__discoveryDialogHint">
            Choose report URLs to ingest. Selected URLs will be queued as jobs
            and the worker service will start to process them.
          </p>

          {uploadsLoading || itemsLoading ? (
            <p className="adminPage__discoveryDialogEmpty" role="status">
              Loading report URLs…
            </p>
          ) : eligibleUploads.length === 0 ? (
            <p className="adminPage__discoveryDialogEmpty" role="status">
              No completed uploads with report URLs found. Upload and import a
              CSV first.
            </p>
          ) : allItems.length === 0 ? (
            <p className="adminPage__discoveryDialogEmpty" role="status">
              No report URLs found in completed uploads.
            </p>
          ) : (
            <div className="adminPage__discoveryFeedListWrap">
              <label className="adminPage__discoveryFeedRow adminPage__discoveryFeedRow--all">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  disabled={starting}
                />
                <span className="adminPage__discoveryFeedAllLabel">
                  All report URLs
                </span>
                <span className="adminPage__discoveryFeedCount">
                  {selectedReportIds.size} of {allItems.length} selected
                </span>
              </label>
              <ul className="adminPage__discoveryFeedList" role="list">
                {eligibleUploads.map((upload) => {
                  const uploadItems = itemsByUploadId[upload.id] ?? [];
                  const selectedInUpload = uploadItems.filter((item) =>
                    selectedReportIds.has(item.id),
                  ).length;
                  const uploadChecked =
                    uploadItems.length > 0 &&
                    selectedInUpload === uploadItems.length;
                  const uploadInputId = `${baseId}-upload-${upload.id}`;
                  const expanded = expandedUploadIds.has(upload.id);
                  const label =
                    upload.suggestedName?.trim() ||
                    upload.fileName ||
                    `Upload #${upload.id}`;

                  return (
                    <li key={upload.id}>
                      <div className="adminPage__discoveryFeedRowWrap">
                        <label
                          className="adminPage__discoveryFeedRow"
                          htmlFor={uploadInputId}
                        >
                          <input
                            id={uploadInputId}
                            type="checkbox"
                            checked={uploadChecked}
                            onChange={(e) =>
                              toggleUpload(upload.id, e.target.checked)
                            }
                            disabled={starting || uploadItems.length === 0}
                          />
                          <span className="adminPage__id">#{upload.id}</span>
                          <span
                            className="adminPage__discoveryFeedUrl"
                            title={label}
                          >
                            {label}
                          </span>
                          <span className="adminPage__discoveryFeedCount">
                            {selectedInUpload}/{uploadItems.length}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="adminPage__discoveryFeedExpandBtn"
                          onClick={() => toggleUploadExpanded(upload.id)}
                          aria-expanded={expanded}
                          aria-label={
                            expanded
                              ? `Collapse report URLs for upload #${upload.id}`
                              : `Expand report URLs for upload #${upload.id}`
                          }
                          disabled={uploadItems.length === 0}
                        >
                          {expanded ? (
                            <ChevronDown size={14} strokeWidth={2} aria-hidden />
                          ) : (
                            <ChevronRight size={14} strokeWidth={2} aria-hidden />
                          )}
                        </button>
                      </div>
                      {uploadItems.length > 0 && expanded ? (
                        <ul className="adminPage__discoveryItemList">
                          {uploadItems.map((item) => {
                            const itemInputId = `${baseId}-item-${item.id}`;
                            return (
                              <li key={item.id}>
                                <label
                                  className="adminPage__discoveryItemRow"
                                  htmlFor={itemInputId}
                                >
                                  <input
                                    id={itemInputId}
                                    type="checkbox"
                                    checked={selectedReportIds.has(item.id)}
                                    onChange={(e) =>
                                      toggleOne(item.id, e.target.checked)
                                    }
                                    disabled={starting}
                                  />
                                  <span className="adminPage__id">
                                    #{item.rowOrder}
                                  </span>
                                  <span
                                    className="adminPage__discoveryItemUrl"
                                    title={item.title ?? item.url}
                                  >
                                    {item.url}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="usersPage__dialogActions">
            <button
              type="button"
              className="usersPage__btn usersPage__btn--logoutTone"
              onClick={close}
              disabled={starting}
            >
              <CircleX size={16} strokeWidth={1.75} aria-hidden />
              Cancel
            </button>
            <button
              type="button"
              className="usersPage__btn usersPage__btn--primary usersPage__btn--inviteSend"
              onClick={handleStart}
              disabled={
                starting ||
                uploadsLoading ||
                itemsLoading ||
                eligibleUploads.length === 0 ||
                selectedReportIds.size === 0
              }
            >
              <Play size={16} strokeWidth={2} aria-hidden />
              {starting ? "Starting…" : "Start worker"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
