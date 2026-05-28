import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ensureUnicodeFont, PDF_FONT } from "./pdf-font";

export type FbQuestionType = "single_choice" | "multi_choice" | "dropdown" | "scale" | "open_text";

export interface FbQuestion {
  id: string;
  position: number;
  question_type: FbQuestionType;
  text: string;
  options?: string[] | null;
  scale_min?: number | null;
  scale_max?: number | null;
}

export interface FbAnswer {
  question_id: string;
  value: unknown;
}

export interface FbResponse {
  id: string;
  submitted_at: string;
  respondent_name?: string | null;
  is_identified?: boolean;
  subject_teacher_id?: string | null;
  subject_teacher_name?: string | null;
  answers: FbAnswer[];
}

export interface FbSection {
  label: string;
  responses: FbResponse[];
}

interface ExportArgs {
  title: string;
  subtitle?: string;
  questions: FbQuestion[];
  responses?: FbResponse[];
  sections?: FbSection[];
  overall?: { label: string; responses: FbResponse[] };
}

function aggregate(q: FbQuestion, responses: FbResponse[]) {
  const values = responses
    .map((r) => r.answers.find((a) => a.question_id === q.id)?.value)
    .filter((v) => v !== undefined && v !== null);

  const skipped = responses.length - values.length;

  if (q.question_type === "scale") {
    const nums = values.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
    if (nums.length === 0) return { kind: "empty" as const, skipped };
    const sum = nums.reduce((a, b) => a + b, 0);
    const sorted = [...nums].sort((a, b) => a - b);
    const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const dist: Record<number, number> = {};
    for (let i = q.scale_min ?? 1; i <= (q.scale_max ?? 5); i++) dist[i] = 0;
    nums.forEach((n) => { dist[n] = (dist[n] ?? 0) + 1; });
    return { kind: "scale" as const, n: nums.length, avg: sum / nums.length, median, dist, skipped };
  }
  if (q.question_type === "open_text") {
    return { kind: "text" as const, items: values.map((v) => String(v ?? "")), skipped };
  }
  // choice / multi / dropdown
  const counts: Record<string, number> = {};
  values.forEach((v) => {
    const arr = Array.isArray(v) ? v : [v];
    arr.forEach((x) => {
      const key = String(x ?? "");
      counts[key] = (counts[key] ?? 0) + 1;
    });
  });
  const total = responses.length;
  return { kind: "choice" as const, counts, total, skipped };
}

export async function exportFeedbackReportPdf({ title, subtitle, questions, responses, sections, overall }: ExportArgs) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureUnicodeFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  let y = 48;

  const allSections: FbSection[] = sections && sections.length
    ? sections
    : [{ label: "", responses: responses ?? [] }];
  const totalResponses = allSections.reduce((s, x) => s + x.responses.length, 0);

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(16);
  doc.text(title, 40, y);
  y += 18;
  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(10);
  if (subtitle) { doc.text(subtitle, 40, y); y += 14; }
  doc.text(`Răspunsuri: ${totalResponses}`, 40, y); y += 16;

  const sortedQ = [...questions].sort((a, b) => a.position - b.position);

  const renderQuestionsFor = (sectionResponses: FbResponse[], qs: FbQuestion[]) => {
    qs.forEach((q, idx) => {
      if (y > 720) { doc.addPage(); y = 48; }
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, pageW - 80);
      doc.text(lines, 40, y);
      y += lines.length * 14 + 4;

      const agg = aggregate(q, sectionResponses);
      doc.setFont(PDF_FONT, "normal");
      doc.setFontSize(10);

      if (agg.kind === "empty") {
        doc.text("Fără răspunsuri.", 50, y); y += 16;
        if (agg.skipped > 0) { doc.text(`Nu au răspuns: ${agg.skipped}`, 50, y); y += 14; }
      } else if (agg.kind === "scale") {
        autoTable(doc, {
          startY: y,
          head: [["Valoare", "Răspunsuri"]],
          body: Object.entries(agg.dist).map(([k, v]) => [k, String(v)]),
          margin: { left: 40, right: 40 },
          styles: { fontSize: 9, font: PDF_FONT },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
        doc.text(`n=${agg.n} • medie=${agg.avg.toFixed(2)} • mediană=${agg.median}${agg.skipped > 0 ? ` • Nu au răspuns: ${agg.skipped}` : ""}`, 40, y);
        y += 16;
      } else if (agg.kind === "choice") {
        const rows = Object.entries(agg.counts).map(([k, v]) => [
          k, String(v), agg.total ? `${((v / agg.total) * 100).toFixed(1)}%` : "—",
        ]);
        if (agg.skipped > 0) {
          rows.push(["Nu au răspuns", String(agg.skipped), agg.total ? `${((agg.skipped / agg.total) * 100).toFixed(1)}%` : "—"]);
        }
        autoTable(doc, {
          startY: y,
          head: [["Opțiune", "Răspunsuri", "%"]],
          body: rows.length ? rows : [["—", "0", "—"]],
          margin: { left: 40, right: 40 },
          styles: { fontSize: 9, font: PDF_FONT },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      } else if (agg.kind === "text") {
        if (agg.items.length === 0) { doc.text("Fără răspunsuri.", 50, y); y += 16; }
        else {
          agg.items.forEach((t) => {
            if (!t.trim()) return;
            const wrapped = doc.splitTextToSize(`• ${t}`, pageW - 90);
            if (y + wrapped.length * 12 > 760) { doc.addPage(); y = 48; }
            doc.text(wrapped, 50, y);
            y += wrapped.length * 12 + 2;
          });
          y += 6;
        }
        if (agg.skipped > 0) { doc.text(`Nu au răspuns: ${agg.skipped}`, 50, y); y += 14; }
      }
    });
  };

  if (overall) {
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(13);
    doc.text(overall.label, 40, y); y += 16;
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(10);
    doc.text(`Răspunsuri totale: ${overall.responses.length}`, 40, y); y += 14;
    const nonOpen = sortedQ.filter((q) => q.question_type !== "open_text");
    renderQuestionsFor(overall.responses, nonOpen);
    if (allSections.length) { doc.addPage(); y = 48; }
  }


  allSections.forEach((section, secIdx) => {
    if (section.label) {
      if (secIdx > 0) { doc.addPage(); y = 48; }
      if (y > 700) { doc.addPage(); y = 48; }
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(13);
      doc.text(section.label, 40, y); y += 16;
      doc.setFont(PDF_FONT, "normal");
      doc.setFontSize(10);
      doc.text(`Răspunsuri: ${section.responses.length}`, 40, y); y += 14;
    }

    sortedQ.forEach((q, idx) => {
      if (y > 720) { doc.addPage(); y = 48; }
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, pageW - 80);
      doc.text(lines, 40, y);
      y += lines.length * 14 + 4;

      const agg = aggregate(q, section.responses);
      doc.setFont(PDF_FONT, "normal");
      doc.setFontSize(10);

      if (agg.kind === "empty") {
        doc.text("Fără răspunsuri.", 50, y); y += 16;
      } else if (agg.kind === "scale") {
        autoTable(doc, {
          startY: y,
          head: [["Valoare", "Răspunsuri"]],
          body: Object.entries(agg.dist).map(([k, v]) => [k, String(v)]),
          margin: { left: 40, right: 40 },
          styles: { fontSize: 9, font: PDF_FONT },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
        doc.text(`n=${agg.n} • medie=${agg.avg.toFixed(2)} • mediană=${agg.median}`, 40, y);
        y += 16;
      } else if (agg.kind === "choice") {
        const rows = Object.entries(agg.counts).map(([k, v]) => [
          k, String(v), agg.total ? `${((v / agg.total) * 100).toFixed(1)}%` : "—",
        ]);
        autoTable(doc, {
          startY: y,
          head: [["Opțiune", "Răspunsuri", "%"]],
          body: rows.length ? rows : [["—", "0", "—"]],
          margin: { left: 40, right: 40 },
          styles: { fontSize: 9, font: PDF_FONT },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      } else if (agg.kind === "text") {
        if (agg.items.length === 0) { doc.text("Fără răspunsuri.", 50, y); y += 16; }
        else {
          agg.items.forEach((t) => {
            if (!t.trim()) return;
            const wrapped = doc.splitTextToSize(`• ${t}`, pageW - 90);
            if (y + wrapped.length * 12 > 760) { doc.addPage(); y = 48; }
            doc.text(wrapped, 50, y);
            y += wrapped.length * 12 + 2;
          });
          y += 6;
        }
      }
    });
  });

  doc.save(`${title.replace(/\s+/g, "_")}_raport.pdf`);
}
