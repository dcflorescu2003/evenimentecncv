import { describe, expect, it } from "vitest";
import { timetableViewsForRoles } from "@/lib/timetable-access";

describe("timetable access", () => {
  it("allows CSE only room schedules", () => {
    expect(timetableViewsForRoles(["cse"])).toEqual(["rooms"]);
  });
  it("does not expose teacher schedules or staffroom to mixed CSE accounts", () => {
    expect(timetableViewsForRoles(["cse", "teacher"])).toEqual(["rooms"]);
  });
  it("preserves all teacher views", () => {
    expect(timetableViewsForRoles(["teacher"])).toEqual(["mine", "rooms", "staff", "classes"]);
    expect(timetableViewsForRoles(["homeroom_teacher"])).toEqual(["mine", "rooms", "staff", "classes"]);
  });
  it("allows admin class lookup", () => {
    expect(timetableViewsForRoles(["admin"])).toEqual(["classes"]);
  });
  it("keeps class lookup unavailable to CSE even with an admin role", () => {
    expect(timetableViewsForRoles(["cse", "admin"])).toEqual(["rooms"]);
  });
  it("does not grant unrelated roles timetable navigation", () => {
    expect(timetableViewsForRoles(["student"])).toEqual([]);
  });
});