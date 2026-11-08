import { describe, expect, it } from "vitest";
import { canViewCsePublicDetails } from "@/lib/cse-event-details";

describe("CSE public event details", () => {
  const event = { created_by: "organizer", is_public: true };
  it("allows CSE to see public participants and contacts for their own event", () => {
    expect(canViewCsePublicDetails(["cse"], "organizer", event)).toBe(true);
  });
  it("does not grant access to another organizer's event", () => {
    expect(canViewCsePublicDetails(["cse"], "other", event)).toBe(false);
  });
  it("does not expose contacts before authentication or event loading", () => {
    expect(canViewCsePublicDetails(["cse"], undefined, event)).toBe(false);
    expect(canViewCsePublicDetails(["cse"], "organizer", undefined)).toBe(false);
  });
  it("keeps nonpublic events and other roles unchanged", () => {
    expect(canViewCsePublicDetails(["cse"], "organizer", { ...event, is_public: false })).toBe(false);
    expect(canViewCsePublicDetails(["teacher"], "organizer", event)).toBe(false);
  });
});