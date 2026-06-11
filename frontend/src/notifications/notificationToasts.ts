import { toast } from "react-toastify";
import type { NotificationItem } from "./types";

const RECENT_CRON_TOAST_MS = 30_000;
let lastCronStartToastAt = 0;
let lastCronStopToastAt = 0;

export function toastCronJobStarted(message?: string): void {
  const now = Date.now();
  if (now - lastCronStartToastAt < RECENT_CRON_TOAST_MS) return;
  lastCronStartToastAt = now;
  toast.info(
    message?.trim() || "RSS feed discovery cron job started.",
    { autoClose: 4000 },
  );
}

export function toastCronJobStopped(message?: string): void {
  const now = Date.now();
  if (now - lastCronStopToastAt < RECENT_CRON_TOAST_MS) return;
  lastCronStopToastAt = now;
  toast.info(
    message?.trim() || "RSS feed discovery cron job stopped.",
    { autoClose: 4000 },
  );
}

export function maybeToastNotification(item: NotificationItem): void {
  if (item.kind === "cron_job_started") {
    toastCronJobStarted(item.message);
  }
  if (item.kind === "cron_job_stopped") {
    toastCronJobStopped(item.message);
  }
}
