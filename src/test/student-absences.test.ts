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
  it("absentele pe zi (4h - realizate) insumate egaleaza Total", () => {
    const r = computeDailyAbsences(days, new Map([[days[0], 2], [days[1], 4], [days[2], 0]]), today);
    const perDayAbsences = days.map((d) => 4 - r.perDay[d]);
    expect(perDayAbsences).toEqual([2, 0, 4, 4]);
    expect(perDayAbsences.reduce((a, b) => a + b, 0)).toBe(r.absences);
  });
});

describe("normă redusă (18h)", () => {
  const wk = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"];
  const calc = (hs: number[]) => computeDailyAbsences(wk, new Map(wk.map((d, i) => [d, hs[i]])), "2026-10-30", 18).absences;
  it("4,4,4,3,3 (18h, zilnic) → 0", () => expect(calc([4, 4, 4, 3, 3])).toBe(0));
  it("4,4,4,4,0 → 4", () => expect(calc([4, 4, 4, 4, 0])).toBe(4));
  it("4,4,3,3,3 (17h) → 3", () => expect(calc([4, 4, 3, 3, 3])).toBe(3));
});
