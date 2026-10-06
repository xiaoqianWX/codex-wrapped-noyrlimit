import { describe, expect, test } from "bun:test";
import { parseDateKey } from "./dates";

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

describe("parseDateKey", () => {
  test.each(["America/New_York", "UTC", "Asia/Shanghai"])("keeps the calendar date in %s", (timeZone) => {
    withTimeZone(timeZone, () => {
      const date = parseDateKey("2026-08-19");

      expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 7, 19]);
      expect(date.getDay()).toBe(3); // Wednesday
    });
  });
});
