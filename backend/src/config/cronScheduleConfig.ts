import { z } from "zod";
import {
  DEFAULT_CRON_TIMEZONE,
  getZonedDateTimeParts,
  isValidTimezone,
  normalizeTimezone,
} from "../utils/cronTimezone.js";

export const REPEAT_UNITS = ["day", "week", "month", "year"] as const;
export type RepeatUnit = (typeof REPEAT_UNITS)[number];

export const cronTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimezone, "Use a valid IANA timezone.");

const scheduleSchema = z.object({
  id: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: cronTimezoneSchema,
  repeat: z.boolean(),
  repeatInterval: z.number().int().positive().max(365),
  repeatUnit: z.enum(REPEAT_UNITS),
  repeatDays: z.array(z.number().int().min(0).max(6)),
  ingestLinkIds: z.array(z.number().int().positive()),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  active: z.boolean(),
});

export type CronScheduleConfig = z.infer<typeof scheduleSchema>;

export type SaveCronScheduleInput = {
  startDate: string;
  startTime: string;
  timezone: string;
  repeat: boolean;
  repeatInterval: number;
  repeatUnit: RepeatUnit;
  repeatDays: number[];
  ingestLinkIds: number[];
};

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map((part) => Number.parseInt(part, 10));
  return { year, month, day };
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = parseDateParts(fromDate);
  const to = parseDateParts(toDate);
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toMs - fromMs) / 86_400_000);
}

function monthsBetween(fromDate: string, toDate: string): number {
  const from = parseDateParts(fromDate);
  const to = parseDateParts(toDate);
  return (to.year - from.year) * 12 + (to.month - from.month);
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeToMinutes(hhmm: string): number {
  const [hourPart, minutePart] = hhmm.split(":");
  const hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function matchesRepeatCadence(
  schedule: CronScheduleConfig,
  today: string,
  weekday: number,
): boolean {
  if (!schedule.repeat) {
    return today === schedule.startDate;
  }

  const days = daysBetween(schedule.startDate, today);
  if (days < 0) return false;

  const interval = schedule.repeatInterval;

  switch (schedule.repeatUnit) {
    case "day":
      return days % interval === 0;
    case "week": {
      const weeks = Math.floor(days / 7);
      if (weeks % interval !== 0) return false;
      return (
        schedule.repeatDays.length === 0 ||
        schedule.repeatDays.includes(weekday)
      );
    }
    case "month": {
      const months = monthsBetween(schedule.startDate, today);
      if (months < 0 || months % interval !== 0) return false;
      const start = parseDateParts(schedule.startDate);
      const current = parseDateParts(today);
      const lastDayOfMonth = new Date(current.year, current.month, 0).getDate();
      const targetDay = Math.min(start.day, lastDayOfMonth);
      return current.day === targetDay;
    }
    case "year": {
      const start = parseDateParts(schedule.startDate);
      const current = parseDateParts(today);
      const years = current.year - start.year;
      if (years < 0 || years % interval !== 0) return false;
      return current.month === start.month && current.day === start.day;
    }
    default:
      return false;
  }
}

function describeRepeatCadenceMismatch(
  schedule: CronScheduleConfig,
  zonedDate: string,
  weekday: number,
  timezone: string,
): string {
  if (!schedule.repeat) {
    return `one-time schedule only runs on ${schedule.startDate} (today is ${zonedDate} in ${timezone})`;
  }

  switch (schedule.repeatUnit) {
    case "day": {
      const days = daysBetween(schedule.startDate, zonedDate);
      return `daily repeat interval does not match (day ${days} since ${schedule.startDate})`;
    }
    case "week": {
      const allowed =
        schedule.repeatDays.length === 0
          ? "any day"
          : schedule.repeatDays.map((day) => DAY_NAMES[day]).join(", ");
      return `weekly repeat does not include ${DAY_NAMES[weekday]} (selected: ${allowed})`;
    }
    case "month":
      return `monthly repeat does not match ${zonedDate} in ${timezone}`;
    case "year":
      return `yearly repeat does not match ${zonedDate} in ${timezone}`;
    default:
      return "repeat cadence does not match today";
  }
}

/** Human-readable reason when the schedule would not run (null = within window). */
export function getCronScheduleSkipReason(
  schedule: CronScheduleConfig,
  now: Date = new Date(),
): string | null {
  if (!schedule.active) return "schedule is inactive";

  const timezone = normalizeTimezone(schedule.timezone ?? DEFAULT_CRON_TIMEZONE);
  const zoned = getZonedDateTimeParts(now, timezone);

  if (schedule.endsOn && zoned.date > schedule.endsOn) {
    return `schedule ended on ${schedule.endsOn}`;
  }

  if (!matchesRepeatCadence(schedule, zoned.date, zoned.weekday)) {
    return describeRepeatCadenceMismatch(
      schedule,
      zoned.date,
      zoned.weekday,
      timezone,
    );
  }

  if (timeToMinutes(zoned.time) < timeToMinutes(schedule.startTime)) {
    return `before start time ${schedule.startTime} ${timezone} (now ${zoned.time})`;
  }

  return null;
}

export function msUntilStartTimeToday(
  schedule: CronScheduleConfig,
  now: Date = new Date(),
): number | null {
  if (!schedule.active) return null;

  const timezone = normalizeTimezone(schedule.timezone ?? DEFAULT_CRON_TIMEZONE);
  const zoned = getZonedDateTimeParts(now, timezone);

  if (schedule.endsOn && zoned.date > schedule.endsOn) return null;
  if (!matchesRepeatCadence(schedule, zoned.date, zoned.weekday)) return null;

  if (timeToMinutes(zoned.time) >= timeToMinutes(schedule.startTime)) return null;

  const [nowHour = 0, nowMinute = 0] = zoned.time
    .split(":")
    .map((part) => Number.parseInt(part, 10));
  const [startHour = 0, startMinute = 0] = schedule.startTime
    .split(":")
    .map((part) => Number.parseInt(part, 10));
  const deltaMs =
    ((startHour * 60 + startMinute) - (nowHour * 60 + nowMinute)) * 60_000;

  return deltaMs > 0 ? deltaMs : null;
}

export function isWithinCronSchedule(
  schedule: CronScheduleConfig,
  now: Date = new Date(),
): boolean {
  return getCronScheduleSkipReason(schedule, now) === null;
}
