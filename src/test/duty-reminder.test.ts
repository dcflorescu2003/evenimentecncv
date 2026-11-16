import { describe, it, expect } from "vitest";
import { reminderContext, dutyRecipients, dutyNotificationId } from "../../supabase/functions/_shared/duty-reminder";
import { displayMonday, weekSlotFor } from "@/lib/duty-schedule";
import { getNotificationUrl } from "@/lib/notification-routing";

describe("notificări profesori de serviciu", () => {
  it("deschide orarul profesorilor și pagina corespunzătoare administratorilor", () => {
    expect(getNotificationUrl({ type: "duty_reminder" }, ["teacher"])).toBe("/prof/orar");
    expect(getNotificationUrl({ type: "duty_reminder" }, ["homeroom_teacher"])).toBe("/prof/orar");
    expect(getNotificationUrl({ type: "duty_reminder" }, ["admin"])).toBe("/admin/schedules");
    expect(getNotificationUrl({ type: "duty_reminder" }, ["student"])).toBeNull();
  });
  it("notifică cu o zi înainte la 15:00 București iarna, nu la 14:00 sau 16:00", () => {
    const context = reminderContext(new Date("2026-11-16T13:00:00Z"), "2026-11-09");
    expect(context).toEqual({ date: "2026-11-17", weekday: 2, weekSlot: "B", due: true });
    expect(reminderContext(new Date("2026-11-16T12:00:00Z"), "2026-11-09").due).toBe(false);
    expect(reminderContext(new Date("2026-11-16T14:00:00Z"), "2026-11-09").due).toBe(false);
  });
  it("păstrează 15:00 vara și după schimbarea orei", () => {
    expect(reminderContext(new Date("2026-07-06T12:00:00Z"), "2026-11-09").due).toBe(true);
    expect(reminderContext(new Date("2026-10-25T13:00:00Z"), "2026-11-09").due).toBe(true);
    expect(reminderContext(new Date("2026-03-29T12:00:00Z"), "2026-11-09").due).toBe(true);
  });
  it("notifică duminică pentru luni, nu trimite pentru sâmbătă sau duminică", () => {
    expect(reminderContext(new Date("2026-11-22T13:00:00Z"), "2026-11-09")).toEqual({ date: "2026-11-23", weekday: 1, weekSlot: "A", due: true });
    expect(reminderContext(new Date("2026-11-20T13:00:00Z"), "2026-11-09").due).toBe(false);
    expect(reminderContext(new Date("2026-11-21T13:00:00Z"), "2026-11-09").due).toBe(false);
  });
  it("selectează numai profesorii din ziua și ciclul salvat, o singură dată pentru ambele ture", () => {
    const context = reminderContext(new Date("2026-11-16T13:00:00Z"), "2026-11-09");
    const recipients = dutyRecipients([
      { week_slot: "B", weekday: 2, shift: "morning", teacher_id: "teacher" },
      { week_slot: "B", weekday: 2, shift: "afternoon", teacher_id: "teacher" },
      { week_slot: "A", weekday: 2, shift: "morning", teacher_id: "wrong-week" },
      { week_slot: "B", weekday: 3, shift: "morning", teacher_id: "wrong-day" },
      { week_slot: "B", weekday: 2, shift: "morning", teacher_id: null },
    ], context);
    expect([...recipients]).toEqual([["teacher", new Set(["morning", "afternoon"])]]);
    expect(context.weekSlot).toBe(weekSlotFor(displayMonday(context.date), "2026-11-09"));
    expect(reminderContext(new Date("2026-11-16T13:00:00Z"), "2026-11-16").weekSlot).toBe("A");
  });
  it("folosește aceeași cheie la reîncercare, distinctă pentru alt profesor sau altă zi", async () => {
    const id = await dutyNotificationId("teacher", "2026-11-17");
    expect(await dutyNotificationId("teacher", "2026-11-17")).toBe(id);
    expect(await dutyNotificationId("teacher2", "2026-11-17")).not.toBe(id);
    expect(await dutyNotificationId("teacher", "2026-11-18")).not.toBe(id);
  });
});