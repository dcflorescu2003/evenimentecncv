import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FeedbackFillPage from "@/pages/feedback/FeedbackFillPage";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "viewer" } }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function openForm(form: Record<string, unknown> | null) {
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({ eq: () => table === "feedback_forms"
      ? { maybeSingle: async () => ({ data: form, error: null }) }
      : { order: async () => ({ data: [], error: null }) } }),
  }));
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/f/form-id"]}>
        <Routes><Route path="/f/:id" element={<FeedbackFillPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Shared feedback access", () => {
  it("does not fetch questions or allow submission when database visibility denies the form", async () => {
    openForm(null);
    await screen.findByRole("alert");
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["feedback_forms"]);
    expect(screen.queryByRole("button", { name: "Trimite" })).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("loads questions and permits answering a readable active form", async () => {
    openForm({ id: "form-id", title: "Feedback permis", status: "active", type: "general", anonymity: "anonymous" });
    expect(await screen.findByRole("button", { name: "Trimite" })).toBeEnabled();
    await waitFor(() => expect(mocks.from).toHaveBeenCalledWith("feedback_questions"));
  });

  it("does not allow answering a readable closed form", async () => {
    openForm({ id: "form-id", title: "Feedback închis", status: "closed", type: "general", anonymity: "anonymous" });
    expect(await screen.findByRole("button", { name: "Trimite" })).toBeDisabled();
  });
});