import { describe, it, expect } from "vitest";
import { weekSlotFor, displayMonday, swapAnchor, nextDutyWeekReport } from "@/lib/duty-schedule";

const ANCHOR = "2026-11-09";
describe("profesori de serviciu – ciclu 2 săptămâni", () => {
  it("săptămâna 09.11 este A, 16.11 este B, 23.11 din nou A", () => {
    expect(weekSlotFor("2026-11-09", ANCHOR)).toBe("A");
    expect(weekSlotFor("2026-11-16", ANCHOR)).toBe("B");
    expect(weekSlotFor("2026-11-23", ANCHOR)).toBe("A");
  });
  it("ciclul continuă și în vacanță (după 6 săptămâni tot A)", () => {
    expect(weekSlotFor("2026-12-21", ANCHOR)).toBe("A");
  });
  it("weekendul arată săptămâna următoare", () => {
    expect(displayMonday("2026-11-14")).toBe("2026-11-16");
    expect(displayMonday("2026-11-11")).toBe("2026-11-09");
  });
  it("Schimbă A-B inversează săptămâna curentă", () => {
    expect(weekSlotFor("2026-11-09", swapAnchor(ANCHOR))).toBe("B");
  });
  it("exportă următoarea săptămână luni-vineri cu doi profesori pe tură din ciclul corect", () => {
    const report = nextDutyWeekReport("2026-11-13", ANCHOR, [
      { week_slot: "B", weekday: 1, shift: "morning", position: 1, teacher_id: "1" },
      { week_slot: "B", weekday: 1, shift: "morning", position: 2, teacher_id: "2" },
      { week_slot: "B", weekday: 1, shift: "afternoon", position: 1, teacher_id: "3" },
      { week_slot: "B", weekday: 1, shift: "afternoon", position: 2, teacher_id: "4" },
      { week_slot: "A", weekday: 1, shift: "morning", position: 1, teacher_id: "wrong-week" },
    ], new Map([["1", "Popescu Ana"], ["2", "Ionescu Ion"], ["3", "Marin Maria"], ["4", "Radu Dan"]]));
    expect(report.monday).toBe("2026-11-16");
    expect(report.rows).toHaveLength(5);
    expect(report.rows[0]).toEqual(["Luni\n16.11.2026", "Popescu Ana\nIonescu Ion", "Marin Maria\nRadu Dan"]);
    expect(report.rows[4]).toEqual(["Vineri\n20.11.2026", "—\n—", "—\n—"]);
  });
});
