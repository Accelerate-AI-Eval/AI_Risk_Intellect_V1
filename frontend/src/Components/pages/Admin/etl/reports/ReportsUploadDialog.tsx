import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CircleX, Tag, Upload, X } from "lucide-react";
import { toast } from "react-toastify";
import "../../../Users/usersPage.css";

export interface ReportsUploadDialogProps {
  open: boolean;
  uploading: boolean;
  reuploadTarget?: { id: number; suggestedName: string | null } | null;
  onClose: () => void;
  onSubmit: (payload: { suggestedName: string; file: File }) => void;
}

export function ReportsUploadDialog({
  open,
  uploading,
  reuploadTarget = null,
  onClose,
  onSubmit,
}: ReportsUploadDialogProps) {
  const baseId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [suggestedName, setSuggestedName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const close = useCallback(() => {
    if (uploading) return;
    setSuggestedName("");
    setSelectedFile(null);
    onClose();
  }, [uploading, onClose]);

  useEffect(() => {
    if (!open) {
      setSuggestedName("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSuggestedName(reuploadTarget?.suggestedName?.trim() ?? "");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    dialogRef.current?.querySelector<HTMLInputElement>("input[type=text]")?.focus();
  }, [open, reuploadTarget]);

  const handleSubmit = useCallback(() => {
    if (!selectedFile) {
      toast.error("Please select a CSV or Excel file.", { autoClose: 2500 });
      return;
    }

    if (!/\.(csv|xlsx|xls)$/i.test(selectedFile.name)) {
      toast.error("Please select a CSV or Excel file.", { autoClose: 2500 });
      return;
    }

    onSubmit({ suggestedName: suggestedName.trim(), file: selectedFile });
  }, [onSubmit, selectedFile, suggestedName]);

  if (!open) return null;

  const titleId = `${baseId}-reports-upload-title`;
  const suggestedNameId = `${baseId}-suggested-name`;
  const fileInputId = `${baseId}-file-input`;

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
            {reuploadTarget ? `Reupload report #${reuploadTarget.id}` : "Upload reports"}
          </h2>
          <button
            type="button"
            className="usersPage__dialogClose"
            onClick={close}
            disabled={uploading}
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="usersPage__dialogBody">
          <label className="usersPage__label usersPage__label--withIcon" htmlFor={suggestedNameId}>
            <Tag className="usersPage__labelIcon" size={16} strokeWidth={2} aria-hidden />
            <span>Suggested name</span>
          </label>
          <input
            id={suggestedNameId}
            type="text"
            className="usersPage__input"
            placeholder="e.g. Q1 2026 reports import"
            value={suggestedName}
            onChange={(e) => setSuggestedName(e.target.value)}
            autoComplete="off"
            maxLength={256}
            disabled={uploading}
          />

          <label className="usersPage__label usersPage__label--withIcon" htmlFor={fileInputId}>
            <Upload className="usersPage__labelIcon" size={16} strokeWidth={2} aria-hidden />
            <span>Upload CSV file</span>
          </label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="usersPage__input"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setSelectedFile(file);
            }}
          />
          {selectedFile ? (
            <p className="adminPage__cardHint" role="status">
              Selected: {selectedFile.name}
            </p>
          ) : null}

          <div className="usersPage__dialogActions">
            <button
              type="button"
              className="usersPage__btn usersPage__btn--logoutTone"
              onClick={close}
              disabled={uploading}
            >
              <CircleX size={16} strokeWidth={1.75} aria-hidden />
              Cancel
            </button>
            <button
              type="button"
              className="usersPage__btn usersPage__btn--primary usersPage__btn--inviteSend"
              onClick={handleSubmit}
              disabled={uploading}
              aria-busy={uploading}
            >
              <Upload size={16} strokeWidth={2} aria-hidden />
              {uploading
                ? reuploadTarget
                  ? "Reuploading…"
                  : "Uploading…"
                : reuploadTarget
                  ? "Reupload"
                  : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
