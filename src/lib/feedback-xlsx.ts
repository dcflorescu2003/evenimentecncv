import * as XLSX from "xlsx";
import type { FbQuestion, FbResponse } from "./feedback-pdf";

export interface FbSection {
  label: string;
  responses: FbResponse[];
}

interface ExportArgs {
  title: string;
  questions: FbQuestion[];
  sections: FbSection[]; // one or more groups (e.g. per teacher, or single "all")
}

function sanitizeSheetName(name: string): string {
  // Excel sheet name: max 31 chars, no [ ] : * ? / \
  return name.replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31) || "Sheet";
}

function valueToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function buildSheet(questions: FbQuestion[], responses: FbResponse[]) {
  const sorted = [...questions].sort((a, b) => a.position - b.position);
  const header = [
    "Data",
    "Respondent",
    "Profesor evaluat",
    ...sorted.map((q, i) => `${i + 1}. ${q.text}`),
  ];
  const rows = responses.map((r) => {
    const ansMap = new Map(r.answers.map((a) => [a.question_id, a.value]));
    return [
      new Date(r.submitted_at).toLocaleString("ro-RO"),
      r.is_identified ? (r.respondent_name ?? "Identificat") : "Anonim",
      r.subject_teacher_name ?? "",
      ...sorted.map((q) => valueToString(ansMap.get(q.id))),
    ];
  });

  // Aggregates section
  const aggRows: (string | number)[][] = [[], ["Rezultate agregate"]];
  sorted.forEach((q, idx) => {
    aggRows.push([`${idx + 1}. ${q.text}`]);
    const vals = responses
      .map((r) => r.answers.find((a) => a.question_id === q.id)?.value)
      .filter((v) => v !== undefined && v !== null);
    if (q.question_type === "scale") {
      const nums = vals.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
      if (!nums.length) aggRows.push(["Fără răspunsuri"]);
      else {
        const sum = nums.reduce((a, b) => a + b, 0);
        aggRows.push(["n", nums.length], ["medie", Number((sum / nums.length).toFixed(2))]);
        const dist: Record<number, number> = {};
        for (let i = q.scale_min ?? 1; i <= (q.scale_max ?? 5); i++) dist[i] = 0;
        nums.forEach((n) => { dist[n] = (dist[n] ?? 0) + 1; });
        Object.entries(dist).forEach(([k, c]) => aggRows.push([`Scor ${k}`, c]));
      }
    } else if (q.question_type === "open_text") {
      if (!vals.length) aggRows.push(["Fără răspunsuri"]);
      else vals.forEach((v) => aggRows.push([String(v ?? "")]));
    } else {
      const counts: Record<string, number> = {};
      vals.forEach((v) => {
        const arr = Array.isArray(v) ? v : [v];
        arr.forEach((x) => {
          const k = String(x ?? "");
          counts[k] = (counts[k] ?? 0) + 1;
        });
      });
      const total = responses.length;
      const keys = (q.options && q.options.length ? q.options : Object.keys(counts));
      keys.forEach((k) => {
        const c = counts[k] ?? 0;
        aggRows.push([k, c, total ? `${((c / total) * 100).toFixed(1)}%` : "—"]);
      });
    }
    aggRows.push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows, ...aggRows]);
  return ws;
}

export function exportFeedbackReportXlsx({ title, questions, sections }: ExportArgs) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const addSheet = (label: string, responses: FbResponse[]) => {
    let name = sanitizeSheetName(label);
    let i = 2;
    while (used.has(name)) name = sanitizeSheetName(`${label} (${i++})`);
    used.add(name);
    XLSX.utils.book_append_sheet(wb, buildSheet(questions, responses), name);
  };
  if (sections.length === 0) {
    addSheet("Toate", []);
  } else {
    sections.forEach((s) => addSheet(s.label, s.responses));
  }
  XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}_raport.xlsx`);
}
