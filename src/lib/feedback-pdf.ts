import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

interface ExportArgs {
  title: string;
  subtitle?: string;
  questions: FbQuestion[];
  responses: FbResponse[];
}

function aggregate(q: FbQuestion, responses: FbResponse[]) {
  const values = responses
    .map((r) => r.answers.find((a) => a.question_id === q.id)?.value)
    .filter((v) => v !== undefined && v !== null);

  if (q.question_type === "scale") {
    const nums = values.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
    if (nums.length === 0) return { kind: "empty" as const };
    const sum = nums.reduce((a, b) => a + b, 0);
    const sorted = [...nums].sort((a, b) => a - b);
    const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const dist: Record<number, number> = {};
    for (let i = q.scale_min ?? 1; i <= (q.scale_max ?? 5); i++) dist[i] = 0;
    nums.forEach((n) => { dist[n] = (dist[n] ?? 0) + 1; });
    return { kind: "scale" as const, n: nums.length, avg: sum / nums.length, median, dist };
  }
  if (q.question_type === "open_text") {
    return { kind: "text" as const, items: values.map((v) => String(v ?? "")) };
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
  return { kind: "choice" as const, counts, total };
}

export function exportFeedbackReportPdf({ title, subtitle, questions, responses }: ExportArgs) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (subtitle) { doc.text(subtitle, 40, y); y += 14; }
  doc.text(`Răspunsuri: ${responses.length}`, 40, y); y += 16;

  questions
    .sort((a, b) => a.position - b.position)
    .forEach((q, idx) => {
      if (y > 720) { doc.addPage(); y = 48; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, pageW - 80);
      doc.text(lines, 40, y);
      y += lines.length * 14 + 4;

      const agg = aggregate(q, responses);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      if (agg.kind === "empty") {
        doc.text("Fără răspunsuri.", 50, y); y += 16;
      } else if (agg.kind === "scale") {
        autoTable(doc, {
          startY: y,
          head: [["Valoare", "Răspunsuri"]],
          body: Object.entries(agg.dist).map(([k, v]) => [k, String(v)]),
          margin: { left: 40, right: 40 },
          styles: { fontSize: 9 },
        });
        // @ts-ignore
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
          styles: { fontSize: 9 },
        });
        // @ts-ignore
        y = (doc as any).lastAutoTable.finalY + 10;
      } else if (agg.kind === "text") {
        if (agg.items.length === 0) { doc.text("Fără răspunsuri.", 50, y); y += 16; }
        else {
          agg.items.forEach((t, i) => {
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

  doc.save(`${title.replace(/\s+/g, "_")}_raport.pdf`);
}
