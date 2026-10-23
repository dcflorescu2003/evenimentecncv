import { describe, it, expect } from "vitest";
import { computeDailyAbsences, weekdaysBetween } from "@/lib/student-hours";

const days = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"];
const today = "2026-10-30";
const run = (h: number) => computeDailyAbsences([days[0]], new Map([[days[0], h]]), today).absences;

describe("computeDailyAbsences", () => {
  it("4h → 0 absențe", () => expect(run(4)).toBe(0));
  it("2h → 2 absențe", () => expect(run(2)).toBe(2));
  it("0h → 4 absențe", () => expect(run(0)).toBe(4));
  it("6h plafonat la 4 → 0 absențe", () => {
    const r = computeDailyAbsences([days[0]], new Map([[days[0], 6]]), today);
    expect(r.perDay[days[0]]).toBe(4);
    expect(r.absences).toBe(0);
  });
  it("zilele de azi și viitoare nu se numără", () => {
    expect(computeDailyAbsences(days, new Map(), "2026-10-21").absences).toBe(8);
  });
  it("weekend ignorat", () => {
    expect(weekdaysBetween("2026-10-23", "2026-10-26")).toEqual(["2026-10-23", "2026-10-26"]);
  });
});
