import { describe, expect, it } from "vitest";

import { formatTime, isValidTime24h, normalizeTimeInput } from "@/lib/time";

describe("formatul de 24 de ore", () => {
  it("acceptă limitele zilei", () => {
    expect(isValidTime24h("00:00")).toBe(true);
    expect(isValidTime24h("23:59")).toBe(true);
  });

  it("respinge orele în afara intervalului", () => {
    expect(isValidTime24h("24:00")).toBe(false);
    expect(isValidTime24h("12:60")).toBe(false);
    expect(isValidTime24h("7:30")).toBe(false);
  });

  it("normalizează introducerea numerică", () => {
    expect(normalizeTimeInput("0730")).toBe("07:30");
    expect(normalizeTimeInput("23:59")).toBe("23:59");
  });

  it("afișează doar orele și minutele", () => {
    expect(formatTime("18:30:00")).toBe("18:30");
    expect(formatTime("00:00")).toBe("00:00");
  });
});
import { joinDatetime as _join, splitDatetime as _split } from "@/lib/time";
describe("booking datetime round-trip", () => {
  for (const [d, t] of [["2026-10-06", "08:00"], ["2026-01-15", "23:30"], ["2026-03-29", "05:00"], ["2026-10-25", "00:15"]]) {
    it(`${d} ${t}`, () => {
      expect(_split(_join(d, t))).toEqual({ date: d, time: t });
    });
  }
});
