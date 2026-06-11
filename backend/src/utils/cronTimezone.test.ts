import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCronScheduleSkipReason,
  isWithinCronSchedule,
  msUntilStartTimeToday,
  type CronScheduleConfig,
} from "../config/cronScheduleConfig.js";
import { computeDiscoveryLoopSleepMs } from "../workers/rssDiscovery.js";
import { getZonedDateTimeParts } from "./cronTimezone.js";

describe("cron timezone helpers", () => {
  it("formats zoned date parts for America/New_York", () => {
    const instant = new Date("2026-06-10T14:30:00.000Z");
    const parts = getZonedDateTimeParts(instant, "America/New_York");
    assert.equal(parts.date, "2026-06-10");
    assert.equal(parts.time, "10:30");
    assert.equal(parts.weekday, 3);
  });

  it("evaluates schedule start time in the configured timezone", () => {
    const schedule: CronScheduleConfig = {
      id: "rss-1",
      startDate: "2026-06-10",
      startTime: "10:30",
      timezone: "America/New_York",
      repeat: false,
      repeatInterval: 1,
      repeatUnit: "week",
      repeatDays: [3],
      ingestLinkIds: [1],
      endsOn: null,
      active: true,
    };

    assert.equal(
      isWithinCronSchedule(schedule, new Date("2026-06-10T14:29:00.000Z")),
      false,
    );
    assert.equal(
      isWithinCronSchedule(schedule, new Date("2026-06-10T14:30:00.000Z")),
      true,
    );
  });

  it("evaluates Asia/Kolkata daily schedule at local start time", () => {
    const schedule: CronScheduleConfig = {
      id: "rss-2",
      startDate: "2026-06-11",
      startTime: "10:30",
      timezone: "Asia/Kolkata",
      repeat: true,
      repeatInterval: 1,
      repeatUnit: "day",
      repeatDays: [],
      ingestLinkIds: [1],
      endsOn: null,
      active: true,
    };

    assert.equal(
      isWithinCronSchedule(schedule, new Date("2026-06-11T05:00:00.000Z")),
      true,
    );
    assert.match(
      getCronScheduleSkipReason(
        schedule,
        new Date("2026-06-11T04:59:00.000Z"),
      ) ?? "",
      /before start time/,
    );
  });

  it("skips weekly schedules when today is not a selected weekday", () => {
    const schedule: CronScheduleConfig = {
      id: "rss-3",
      startDate: "2026-06-11",
      startTime: "10:30",
      timezone: "Asia/Kolkata",
      repeat: true,
      repeatInterval: 1,
      repeatUnit: "week",
      repeatDays: [2],
      ingestLinkIds: [1],
      endsOn: null,
      active: true,
    };

    assert.match(
      getCronScheduleSkipReason(
        schedule,
        new Date("2026-06-11T05:00:00.000Z"),
      ) ?? "",
      /weekly repeat does not include Thu/,
    );
  });

  it("waits until start time when before the configured local time", () => {
    const schedule: CronScheduleConfig = {
      id: "rss-4",
      startDate: "2026-06-11",
      startTime: "10:39",
      timezone: "Asia/Kolkata",
      repeat: true,
      repeatInterval: 1,
      repeatUnit: "day",
      repeatDays: [],
      ingestLinkIds: [1],
      endsOn: null,
      active: true,
    };

    assert.equal(
      msUntilStartTimeToday(schedule, new Date("2026-06-11T05:09:00.000Z")),
      null,
    );
    assert.equal(
      msUntilStartTimeToday(schedule, new Date("2026-06-11T05:08:00.000Z")),
      60_000,
    );
  });
});

describe("discovery loop sleep", () => {
  const intervalMs = 15 * 60_000;

  const schedule: CronScheduleConfig = {
    id: "rss-3",
    startDate: "2026-06-11",
    startTime: "10:39",
    timezone: "Asia/Kolkata",
    repeat: true,
    repeatInterval: 1,
    repeatUnit: "day",
    repeatDays: [],
    ingestLinkIds: [1],
    endsOn: null,
    active: true,
  };

  it("sleeps until start time when before the daily window", () => {
    const now = new Date("2026-06-11T05:08:00.000Z"); // 10:38 IST
    assert.equal(
      computeDiscoveryLoopSleepMs(intervalMs, 100, schedule, now),
      60_000,
    );
  });

  it("uses poll interval when already within the schedule window", () => {
    const now = new Date("2026-06-11T05:09:00.000Z"); // 10:39 IST
    assert.equal(
      computeDiscoveryLoopSleepMs(intervalMs, 100, schedule, now),
      intervalMs - 100,
    );
  });
});
