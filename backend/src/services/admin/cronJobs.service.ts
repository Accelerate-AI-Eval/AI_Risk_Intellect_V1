import type { CronScheduleConfig, SaveCronScheduleInput } from "../../config/cronScheduleConfig.js";
import {
  RSS_CRON_SERVICE_ID,
  deactivateAllRssCronSchedules,
  loadActiveCronScheduleConfig,
  sanitizeCronScheduleFeeds,
  saveCronScheduleConfig,
} from "./cronSchedule.service.js";
import { resolveActiveIngestLinksByIds } from "./ingestLinks.service.js";
import {
  getZonedDateTimeParts,
  normalizeTimezone,
} from "../../utils/cronTimezone.js";
import {
  getDiscoveryStatus,
  restartDiscoveryLoopProcess,
  scheduleNextCronDiscoveryRun,
  stopDiscoveryProcess,
} from "./discoveryManager.service.js";
import { createLogger } from "../../logger/index.js";
import { recordCronJobEvent } from "./cronJobEvents.service.js";
import { formatCronScheduledMessage } from "./cronNotificationMessages.js";

const cronJobsLog = createLogger("cron-jobs");

/** Schedule the next cron run after server boot (service stays stopped until run time). */
async function ensureActiveCronDiscoveryRunning(): Promise<void> {
  const schedule = await loadActiveCronScheduleConfig();
  if (!schedule?.active || schedule.ingestLinkIds.length === 0) {
    return;
  }
  if (getDiscoveryStatus().running) {
    return;
  }

  try {
    scheduleNextCronDiscoveryRun(schedule);
    cronJobsLog.info("Scheduled next cron discovery run", {
      scheduleId: schedule.id,
    });
  } catch (err) {
    cronJobsLog.error("Failed to schedule cron discovery", { err });
  }
}

export type CronJobDefinition = {
  id: string;
  name: string;
  description: string;
  schedule: CronScheduleConfig;
  /** Saved schedule is active in the database. */
  enabled: boolean;
  /** Background discovery loop process is running (waits until the schedule window). */
  running: boolean;
  serviceKey: "discovery" | null;
};

export async function listCronJobs(): Promise<CronJobDefinition[]> {
  const schedule = await sanitizeCronScheduleFeeds(RSS_CRON_SERVICE_ID);
  const discoveryRunning = getDiscoveryStatus().running;

  return [
    {
      id: schedule.id,
      name: "RSS feed discovery",
      description:
        "Poll selected RSS feeds and enqueue extracted article URLs.",
      schedule,
      enabled: schedule.active,
      running: discoveryRunning,
      serviceKey: "discovery",
    },
  ];
}

export async function saveCronJobSchedule(
  jobId: string,
  input: SaveCronScheduleInput,
): Promise<CronJobDefinition> {
  if (jobId !== RSS_CRON_SERVICE_ID) {
    throw new Error("Unknown cron job.");
  }

  if (
    input.repeat &&
    input.repeatUnit === "week" &&
    input.repeatDays.length === 0
  ) {
    throw new Error("Select at least one day for a weekly repeat.");
  }

  if (input.ingestLinkIds.length === 0) {
    throw new Error("Select at least one RSS feed.");
  }

  const timezone = normalizeTimezone(input.timezone);
  const scheduleInput = {
    ...input,
    timezone,
  };

  const todayInScheduleTz = getZonedDateTimeParts(new Date(), timezone).date;
  if (scheduleInput.startDate > todayInScheduleTz) {
    throw new Error(
      `Start date must be on or before today (${todayInScheduleTz}) in ${timezone}.`,
    );
  }

  const links = await resolveActiveIngestLinksByIds(scheduleInput.ingestLinkIds);

  const schedule = await saveCronScheduleConfig({
    ...scheduleInput,
    ingestLinkIds: links.map((link) => link.id),
  });

  await recordCronJobEvent(
    schedule.id,
    "scheduled",
    formatCronScheduledMessage(schedule, links.length),
  );

  restartDiscoveryLoopProcess();

  const discoveryRunning = getDiscoveryStatus().running;

  return {
    id: schedule.id,
    name: "RSS feed discovery",
    description:
      "Poll selected RSS feeds and enqueue extracted article URLs.",
    schedule,
    enabled: schedule.active,
    running: discoveryRunning,
    serviceKey: "discovery",
  };
}

export async function resumeActiveCronJobServices(): Promise<void> {
  try {
    await sanitizeCronScheduleFeeds(RSS_CRON_SERVICE_ID);
    const schedule = await loadActiveCronScheduleConfig();
    if (!schedule?.active || schedule.ingestLinkIds.length === 0) {
      cronJobsLog.info("No active cron schedule to resume");
      return;
    }

    await ensureActiveCronDiscoveryRunning();
  } catch (err) {
    cronJobsLog.error("Failed to resume active cron services", { err });
  }
}

export async function stopCronJobSchedule(
  jobId: string,
): Promise<CronJobDefinition> {
  if (jobId !== RSS_CRON_SERVICE_ID) {
    throw new Error("Unknown cron job.");
  }

  await deactivateAllRssCronSchedules();
  stopDiscoveryProcess();

  const jobs = await listCronJobs();
  const job = jobs[0];
  if (!job) {
    throw new Error("Cron job could not be loaded after stop.");
  }

  return job;
}
