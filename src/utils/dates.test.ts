import { describe, expect, test } from "bun:test";
import { generateWeeksForYear, parseDateKey } from "./dates";

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

describe("generateWeeksForYear", () => {
  test("pads the first week so Jan 1 stays in its weekday row", () => {
    // 2025-01-01 is a Wednesday
    const weeks = generateWeeksForYear(2025);

    expect(weeks[0]).toEqual(["", "", "", "2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04"]);
    expect(weeks[1][0]).toBe("2025-01-05");
  });

  test("does not pad when Jan 1 is a Sunday", () => {
    const weeks = generateWeeksForYear(2023);

    expect(weeks[0]).toEqual([
      "2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06", "2023-01-07",
    ]);
  });

  test("places every date of the year in its weekday row", () => {
    const weeks = generateWeeksForYear(2025);

    expect(weeks.flat().filter(Boolean)).toHaveLength(365);
    for (const week of weeks) {
      week.forEach((dateStr, row) => {
        if (dateStr) expect(parseDateKey(dateStr).getDay()).toBe(row);
      });
    }
  });
});
