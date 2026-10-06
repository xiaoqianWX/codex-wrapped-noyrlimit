import { describe, expect, test } from "bun:test";
import { countActivityByWeekday, findMostActiveDay } from "./stats";

function withTimeZone<T>(timeZone: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

describe("countActivityByWeekday", () => {
  test("counts by local calendar date in a time zone behind UTC", () => {
    withTimeZone("America/New_York", () => {
      // `new Date("2026-08-19")` is UTC midnight, which is Tuesday evening in New York.
      expect(new Date("2026-08-19").getDay()).toBe(2);

      const counts = countActivityByWeekday(new Map([["2026-08-19", 5], ["2026-09-05", 2]]));

      expect(counts).toEqual([0, 0, 0, 5, 0, 0, 2]);
    });
  });
});

describe("findMostActiveDay", () => {
  test.each(["America/New_York", "Asia/Shanghai"])("names the weekday of the busiest date in %s", (timeZone) => {
    withTimeZone(timeZone, () => {
      // Wednesdays add up to more messages (5 + 7) than the single busiest date, a Saturday.
      const day = findMostActiveDay(new Map([["2026-08-19", 5], ["2026-09-05", 9], ["2026-09-09", 7]]));

      expect(day).toEqual({ date: "2026-09-05", count: 9, formattedDate: "Sep 5", weekdayName: "Saturday" });
    });
  });

  test("returns null without activity", () => {
    expect(findMostActiveDay(new Map())).toBeNull();
  });
});
