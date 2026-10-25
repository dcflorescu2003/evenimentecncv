import { describe, expect, it } from "vitest";
import { diplomaRegistrationNumber } from "@/lib/volunteer-diploma";

describe("numerotarea diplomelor de voluntariat", () => {
  it("inserează numere consecutive de la 1 după numărul de înregistrare", () => {
    expect([0, 1, 2].map((index) => diplomaRegistrationNumber("123/23/02/2026", index)))
      .toEqual(["123/1/23/02/2026", "123/2/23/02/2026", "123/3/23/02/2026"]);
  });

  it("reîncepe de la 1 la fiecare export", () => {
    expect(diplomaRegistrationNumber("123/23/02/2026", 7)).toBe("123/8/23/02/2026");
    expect(diplomaRegistrationNumber("123/23/02/2026", 0)).toBe("123/1/23/02/2026");
  });

  it("păstrează spațiile de completat când numărul nu este introdus", () => {
    expect(diplomaRegistrationNumber(undefined, 0)).toBeUndefined();
    expect(diplomaRegistrationNumber("", 2)).toBeUndefined();
  });
});