import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { exportFeedbackReportXlsx } from "@/lib/feedback-xlsx";
import { exportFeedbackReportPdf } from "@/lib/feedback-pdf";
import { downloadFileMobileSafe } from "@/lib/download";
import type { FbQuestion, FbResponse } from "@/lib/feedback-pdf";

const native = vi.hoisted(() => ({ writeFile: vi.fn(), share: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/filesystem", () => ({ Directory: { Cache: "CACHE" }, Filesystem: native }));
vi.mock("@capacitor/share", () => ({ Share: native }));
vi.mock("@/lib/pdf-font", () => ({ PDF_FONT: "helvetica", ensureUnicodeFont: vi.fn() }));

const questions: FbQuestion[] = [{ id: "q1", position: 1, question_type: "open_text", text: "Observatii" }];
const responses: FbResponse[] = [{ id: "r1", submitted_at: "2026-10-29T03:55:00Z", answers: [{ question_id: "q1", value: "Raspuns real" }] }];

beforeEach(() => {
  vi.clearAllMocks();
  native.writeFile.mockResolvedValue({ uri: "file:///cache/raport" });
  native.share.mockResolvedValue({});
});

describe("Feedback file delivery in native apps", () => {
  it("saves a valid PDF in cache and opens native sharing", async () => {
    await exportFeedbackReportPdf({ title: "Feedback / clasa", questions, responses });
    const saved = native.writeFile.mock.calls[0][0];
    expect(saved.path).toBe("Feedback_clasa_raport.pdf");
    expect(atob(saved.data).startsWith("%PDF-")).toBe(true);
    expect(native.share).toHaveBeenCalledWith(expect.objectContaining({ url: "file:///cache/raport" }));
  });

  it("saves an Excel workbook with responses and unique truncated sheet names", async () => {
    const prefix = "Profesor cu un nume foarte lung identic";
    await exportFeedbackReportXlsx({ title: "Feedback", questions, sections: [
      { label: prefix + " A", responses }, { label: prefix + " B", responses },
      { label: prefix.toUpperCase() + " C", responses },
    ] });
    const saved = native.writeFile.mock.calls[0][0];
    expect(saved.path).toBe("Feedback_raport.xlsx");
    const wb = XLSX.read(saved.data, { type: "base64" });
    expect(wb.SheetNames).toHaveLength(3);
    expect(new Set(wb.SheetNames.map(n => n.toLowerCase())).size).toBe(3);
    expect(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })[1]).toContain("Raspuns real");
    expect(native.share).toHaveBeenCalledOnce();
  });

  it("reports native save failures without opening an empty file", async () => {
    native.writeFile.mockRejectedValueOnce(new Error("Save failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await downloadFileMobileSafe("raport.pdf", "JVBERi0=", "application/pdf");
    expect(native.share).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});