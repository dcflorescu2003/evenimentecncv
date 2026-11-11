import { describe, it, expect } from "vitest";
import { weekSlotFor, displayMonday, swapAnchor } from "@/lib/duty-schedule";

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
});
