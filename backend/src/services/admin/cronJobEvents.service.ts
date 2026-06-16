import { db } from "../../db/index.js";
import { cronJobEvents } from "../../schema/cronJobs/cronJobEvents.js";

export type CronJobEventType = "started" | "stopped" | "scheduled" | "completed";

export async function recordCronJobEvent(
  jobId: string,
  eventType: CronJobEventType,
  message?: string,
): Promise<void> {
  await db.insert(cronJobEvents).values({
    jobId,
    eventType,
    message: message?.trim() || null,
  });
}
