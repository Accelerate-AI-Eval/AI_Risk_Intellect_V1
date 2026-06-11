/** Reference timezone for IST display in the UI. */
export const CRON_SCHEDULE_TIMEZONE = "Asia/Kolkata";

export const DEFAULT_CRON_TIMEZONE = "UTC";

const WEEKDAY_FROM_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type ZonedDateTimeParts = {
  date: string;
  time: string;
  weekday: number;
};

export function isValidTimezone(timezone: string): boolean {
  if (!timezone.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(
  timezone: string | null | undefined,
): string {
  const candidate = timezone?.trim();
  if (candidate && isValidTimezone(candidate)) return candidate;
  return DEFAULT_CRON_TIMEZONE;
}

export function getZonedDateTimeParts(
  instant: Date,
  timezone: string,
): ZonedDateTimeParts {
  const tz = normalizeTimezone(timezone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = read("year");
  const month = read("month");
  const day = read("day");
  let hour = read("hour");
  const minute = read("minute");
  const weekdayLabel = read("weekday");

  if (hour === "24") hour = "00";

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
    weekday: WEEKDAY_FROM_SHORT[weekdayLabel] ?? 0,
  };
}
