import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FeedbackReportPage from "@/pages/feedback/FeedbackReportPage";

const mocks = vi.hoisted(() => ({ from: vi.fn(), ownerFilter: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "cse-account" } }) }));
vi.mock("@/lib/feedback-pdf", () => ({ exportFeedbackReportPdf: vi.fn() }));
vi.mock("@/lib/feedback-xlsx", () => ({ exportFeedbackReportXlsx: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function openReport(createdBy: string) {
  mocks.from.mockImplementation((table: string) => {
    let owner: string | undefined;
    const query = {
      select: () => query,
      eq: (column: string, value: string) => {
        if (column === "created_by") { owner = value; mocks.ownerFilter(value); }
        return query;
      },
      maybeSingle: async () => ({ data: !owner || owner === createdBy
        ? { id: "form-id", created_by: createdBy, title: "Chestionar", type: "general", anonymity: "anonymous" }
        : null, error: null }),
      order: async () => ({ data: [], error: null }),
    };
    return query;
  });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/prof/feedback/form-id/report"]}>
        <Routes><Route path="/prof/feedback/:id/report" element={<FeedbackReportPage mode="cse" />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CSE feedback ownership", () => {
  it("denies another creator's report without reading questions or answers", async () => {
    openReport("other-cse-account");
    await screen.findByRole("alert");
    expect(mocks.ownerFilter).toHaveBeenCalledWith("cse-account");
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["feedback_forms"]);
  });

  it("loads the account's own questions and responses", async () => {
    openReport("cse-account");
    await waitFor(() => {
      expect(mocks.from).toHaveBeenCalledWith("feedback_questions");
      expect(mocks.from).toHaveBeenCalledWith("feedback_responses");
    });
    expect(mocks.ownerFilter).toHaveBeenCalledWith("cse-account");
  });
});