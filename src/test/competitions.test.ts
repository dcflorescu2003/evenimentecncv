import { describe, it, expect } from "vitest";
import { buildAwardRows, countBy, currentAcademicYear } from "@/lib/competitions";

const base = { competitionId: "c1", stage: "nationala" as const, prize: "locul_1" as const, academicYear: "2026-2027", teacherId: "t1" };

describe("competitions", () => {
  it("creează câte un premiu pentru fiecare elev selectat", () => {
    expect(buildAwardRows(base, ["a", "b", "c"])).toHaveLength(3);
  });
  it("nu dublează un elev selectat de două ori", () => {
    expect(buildAwardRows(base, ["a", "a"])).toHaveLength(1);
  });
  it("salvează profesorul care adaugă ca coordonator", () => {
    expect(buildAwardRows(base, ["a"])[0].teacher_id).toBe("t1");
  });
  it("totaluri pe premiu", () => {
    expect(countBy([{ p: "aur" }, { p: "aur" }, { p: "bronz" }], (x) => x.p)).toEqual({ aur: 2, bronz: 1 });
  });
  it("anul școlar începe în septembrie", () => {
    expect(currentAcademicYear(new Date(2026, 9, 28))).toBe("2026-2027");
    expect(currentAcademicYear(new Date(2027, 5, 1))).toBe("2026-2027");
  });
});
