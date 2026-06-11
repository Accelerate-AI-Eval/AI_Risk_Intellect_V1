import type { SaveCronScheduleInput } from "./cronJobsApi";
import {
  CRON_SCHEDULE_TIMEZONE,
  formatTimezoneOption,
} from "./cronTimezones";

const WEEKDAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function formatInterval(interval: number, unit: string): string {
  if (interval === 1) return unit;
  const plural = unit.endsWith("s") ? unit : `${unit}s`;
  return `${interval} ${plural}`;
}

function formatScheduleAtTime(
  schedule: Pick<SaveCronScheduleInput, "startDate" | "startTime" | "timezone">,
): string {
  if (schedule.timezone === CRON_SCHEDULE_TIMEZONE) {
    return `at ${schedule.startTime}`;
  }

  const regionLabel = formatTimezoneOption(schedule.timezone);
  return `at ${schedule.startTime} (${regionLabel})`;

  // IST conversion in summary (hidden per product request):
  // const ist = convertWallTimeBetweenZones(
  //   schedule.startDate,
  //   schedule.startTime,
  //   schedule.timezone,
  //   CRON_SCHEDULE_TIMEZONE,
  // );
  // return `at ${schedule.startTime} (${regionLabel}) · ${ist.time} IST`;
}

export function formatCronScheduleSummary(
  schedule: Pick<
    SaveCronScheduleInput,
    | "startDate"
    | "startTime"
    | "timezone"
    | "repeat"
    | "repeatInterval"
    | "repeatUnit"
    | "repeatDays"
  >,
): string {
  const atTime = formatScheduleAtTime(schedule);

  if (!schedule.repeat) {
    return `Occurs once on ${schedule.startDate} ${atTime}`;
  }

  const every = formatInterval(schedule.repeatInterval, schedule.repeatUnit);

  if (schedule.repeatUnit === "week") {
    const days =
      schedule.repeatDays.length > 0
        ? schedule.repeatDays
            .map((day) => WEEKDAY_LABELS[day] ?? "")
            .filter(Boolean)
            .join(", ")
        : "no days selected";
    return `Occurs every ${every} on ${days} ${atTime}`;
  }

  if (schedule.repeatUnit === "day") {
    return `Occurs every ${every} ${atTime}`;
  }

  if (schedule.repeatUnit === "month") {
    const day = Number.parseInt(schedule.startDate.split("-")[2] ?? "1", 10);
    return `Occurs every ${every} on the ${ordinal(day)} ${atTime}`;
  }

  return `Occurs every ${every} on ${schedule.startDate.slice(5)} ${atTime}`;
}
