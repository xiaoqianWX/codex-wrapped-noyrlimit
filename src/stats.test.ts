import { describe, expect, test } from "bun:test";
import { countActivityByWeekday } from "./stats";

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
