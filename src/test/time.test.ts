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