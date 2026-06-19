import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "./csv-export";
import { exportReportPdfSections } from "./report-pdf";
import { DOCUMENT_CATEGORIES, JOURNAL_TYPES, TEACHER_ITEM_CATEGORIES } from "./portfolioMisc";

export interface ReportSection {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface BuiltReport {
  title: string;
  subtitle?: string;
  filename: string;
  sections: ReportSection[];
}

const ro = (a: string, b: string) => a.localeCompare(b, "ro");
const dateRO = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("ro-RO") : "—";

// ---------- Per clasă ----------
export async function buildClassReport(
  teacherId: string,
  classId: string,
  className: string,
  academicYear: string | null,
): Promise<BuiltReport> {
  // 1) Elevii din clasă
  const { data: enrolls, error: e1 } = await supabase
    .from("student_class_assignments")
    .select("student_id, profiles!student_class_assignments_student_id_fkey(id, first_name, last_name)")
    .eq("class_id", classId);
  if (e1) throw e1;

  const students = (enrolls ?? [])
    .map((r: any) => r.profiles)
    .filter(Boolean)
    .sort((a: any, b: any) => ro(a.last_name ?? "", b.last_name ?? ""));

  const studentIds = students.map((s: any) => s.id);
  if (studentIds.length === 0) {
    return {
      title: `Raport clasă: ${className}`,
      subtitle: academicYear ? `An școlar ${academicYear}` : undefined,
      filename: `raport-clasa-${className}`,
      sections: [{ title: "Elevi", headers: ["Elev"], rows: [["Nu există elevi."]] }],
    };
  }

  // 2) Submissions ale temelor profesorului
  const { data: assigns } = await supabase
    .from("portfolio_assignments")
    .select("id")
    .eq("teacher_id", teacherId);
  const assignIds = (assigns ?? []).map((a) => a.id);
  const { data: subs } = assignIds.length
    ? await supabase
        .from("portfolio_submissions")
        .select("student_id, status")
        .in("assignment_id", assignIds)
        .in("student_id", studentIds)
    : { data: [] as any[] };

  // 3) Implicare aprobată
  const { data: inv } = await supabase
    .from("portfolio_involvement")
    .select("student_id, status, hours")
    .eq("teacher_id", teacherId)
    .in("student_id", studentIds);

  // 4) Concursuri
  const { data: comps } = await supabase
    .from("portfolio_competitions")
    .select("id")
    .eq("teacher_id", teacherId);
  const compIds = (comps ?? []).map((c) => c.id);
  const { data: signups } = compIds.length
    ? await supabase
        .from("portfolio_competition_signups")
        .select("student_id, status, award")
        .in("competition_id", compIds)
        .in("student_id", studentIds)
    : { data: [] as any[] };

  // 5) Diplome
  const { data: diplomas } = await supabase
    .from("portfolio_student_diplomas")
    .select("student_id")
    .eq("teacher_id", teacherId)
    .in("student_id", studentIds);

  // 6) Board picks
  const { data: picks } = await supabase
    .from("portfolio_board_picks")
    .select("student_id, score")
    .eq("teacher_id", teacherId)
    .in("student_id", studentIds);

  const rows = students.map((s: any) => {
    const sSubs = (subs ?? []).filter((x: any) => x.student_id === s.id);
    const sInv = (inv ?? []).filter((x: any) => x.student_id === s.id && x.status === "approved");
    const sSign = (signups ?? []).filter((x: any) => x.student_id === s.id);
    const sDip = (diplomas ?? []).filter((x: any) => x.student_id === s.id);
    const sPicks = (picks ?? []).filter((x: any) => x.student_id === s.id);
    const totalInvHours = sInv.reduce((acc: number, x: any) => acc + Number(x.hours ?? 0), 0);
    const scores = sPicks.map((p: any) => Number(p.score ?? 0)).filter((n) => n > 0);
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "—";
    return [
      `${s.last_name ?? ""} ${s.first_name ?? ""}`.trim(),
      `${sSubs.length} (${sSubs.filter((x: any) => x.status === "approved").length} aprobate)`,
      `${sInv.length} (${totalInvHours}h)`,
      `${sSign.length} (${sSign.filter((x: any) => x.award).length} premiate)`,
      String(sDip.length),
      `${sPicks.length} (medie: ${avgScore})`,
    ];
  });

  return {
    title: `Raport clasă: ${className}`,
    subtitle: academicYear ? `An școlar ${academicYear}` : undefined,
    filename: `raport-clasa-${className.replace(/\s+/g, "_")}`,
    sections: [
      {
        title: "Elevi",
        headers: ["Elev", "Teme", "Implicare", "Concursuri", "Diplome", "Tablă"],
        rows,
      },
    ],
  };
}

// ---------- Per elev ----------
export async function buildStudentReport(
  teacherId: string,
  studentId: string,
  academicYear: string | null,
): Promise<BuiltReport> {
  const { data: student } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", studentId)
    .maybeSingle();

  let q = supabase
    .from("portfolio_items")
    .select("title, description, source, academic_year, created_at")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (academicYear) q = q.eq("academic_year", academicYear);
  const { data: items, error } = await q;
  if (error) throw error;

  const sourceLabel: Record<string, string> = {
    submission: "Temă", involvement: "Implicare", competition: "Concurs",
    diploma: "Diplomă", board_pick: "Tablă", manual: "Manual",
  };

  const grouped: Record<string, any[]> = {};
  for (const it of items ?? []) {
    const k = it.source ?? "manual";
    (grouped[k] ??= []).push(it);
  }

  const sections: ReportSection[] = Object.entries(grouped).map(([k, arr]) => ({
    title: sourceLabel[k] ?? k,
    headers: ["Data", "Titlu", "Descriere"],
    rows: arr.map((it) => [dateRO(it.created_at), it.title ?? "—", it.description ?? ""]),
  }));

  const name = student ? `${student.last_name ?? ""} ${student.first_name ?? ""}`.trim() : "Elev";
  return {
    title: `Portofoliu elev: ${name}`,
    subtitle: academicYear ? `An școlar ${academicYear}` : undefined,
    filename: `portofoliu-${name.replace(/\s+/g, "_")}`,
    sections: sections.length ? sections : [{ title: "Niciun element", headers: ["—"], rows: [["Niciun element în portofoliu."]] }],
  };
}

// ---------- Activitate profesor ----------
export async function buildTeacherActivityReport(
  teacherId: string,
  academicYear: string | null,
): Promise<BuiltReport> {
  const yearFilter = <T extends { eq: any }>(q: T): T =>
    (academicYear ? q.eq("academic_year", academicYear) : q) as T;

  const [
    assigns, subs, invAll, comps, signups, journal, docs, items,
  ] = await Promise.all([
    yearFilter(supabase.from("portfolio_assignments").select("id, title, archived").eq("teacher_id", teacherId) as any),
    (async () => {
      const { data: a } = await supabase.from("portfolio_assignments").select("id").eq("teacher_id", teacherId);
      const ids = (a ?? []).map((x: any) => x.id);
      if (!ids.length) return { data: [] as any[] };
      return await supabase.from("portfolio_submissions").select("status").in("assignment_id", ids);
    })(),
    supabase.from("portfolio_involvement").select("status, hours").eq("teacher_id", teacherId),
    yearFilter(supabase.from("portfolio_competitions").select("id, title, status").eq("teacher_id", teacherId) as any),
    (async () => {
      const { data: c } = await supabase.from("portfolio_competitions").select("id").eq("teacher_id", teacherId);
      const ids = (c ?? []).map((x: any) => x.id);
      if (!ids.length) return { data: [] as any[] };
      return await supabase.from("portfolio_competition_signups").select("status, award").in("competition_id", ids);
    })(),
    yearFilter(supabase.from("portfolio_journal").select("type, relevant_for_annual_report").eq("teacher_id", teacherId) as any),
    yearFilter(supabase.from("portfolio_documents").select("category, status").eq("teacher_id", teacherId) as any),
    yearFilter(supabase.from("portfolio_teacher_items").select("category").eq("teacher_id", teacherId) as any),
  ]);

  const assignArr = (assigns as any).data ?? [];
  const subsArr = (subs as any).data ?? [];
  const invArr = (invAll as any).data ?? [];
  const compsArr = (comps as any).data ?? [];
  const signupsArr = (signups as any).data ?? [];
  const journalArr = (journal as any).data ?? [];
  const docsArr = (docs as any).data ?? [];
  const itemsArr = (items as any).data ?? [];

  const docByCat: Record<string, number> = {};
  for (const d of docsArr) docByCat[d.category] = (docByCat[d.category] ?? 0) + 1;
  const itemByCat: Record<string, number> = {};
  for (const i of itemsArr) itemByCat[i.category] = (itemByCat[i.category] ?? 0) + 1;
  const journalByType: Record<string, number> = {};
  for (const j of journalArr) journalByType[j.type] = (journalByType[j.type] ?? 0) + 1;

  const summary: [string, string][] = [
    ["Teme create", String(assignArr.length)],
    ["Teme active (nearhivate)", String(assignArr.filter((a: any) => !a.archived).length)],
    ["Trimiteri primite", String(subsArr.length)],
    ["Trimiteri aprobate", String(subsArr.filter((s: any) => s.status === "approved").length)],
    ["Trimiteri respinse", String(subsArr.filter((s: any) => s.status === "rejected").length)],
    ["Implicări aprobate", String(invArr.filter((i: any) => i.status === "approved").length)],
    ["Ore implicare validate", String(invArr.filter((i: any) => i.status === "approved").reduce((a: number, b: any) => a + Number(b.hours ?? 0), 0))],
    ["Concursuri organizate", String(compsArr.length)],
    ["Înscrieri concurs", String(signupsArr.length)],
    ["Elevi premiați", String(signupsArr.filter((s: any) => s.award).length)],
    ["Intrări jurnal", String(journalArr.length)],
    ["Intrări marcate pentru raport anual", String(journalArr.filter((j: any) => j.relevant_for_annual_report).length)],
    ["Documente birocratice", String(docsArr.length)],
    ["Materiale proprii (portofoliu profesor)", String(itemsArr.length)],
  ];

  const sections: ReportSection[] = [
    { title: "Sinteză", headers: ["Indicator", "Valoare"], rows: summary },
  ];
  if (Object.keys(journalByType).length) {
    sections.push({
      title: "Jurnal pe tipuri",
      headers: ["Tip", "Număr"],
      rows: Object.entries(journalByType).map(([k, v]) => [JOURNAL_TYPES[k] ?? k, String(v)]),
    });
  }
  if (Object.keys(docByCat).length) {
    sections.push({
      title: "Documente pe categorii",
      headers: ["Categorie", "Număr"],
      rows: Object.entries(docByCat).map(([k, v]) => [DOCUMENT_CATEGORIES[k] ?? k, String(v)]),
    });
  }
  if (Object.keys(itemByCat).length) {
    sections.push({
      title: "Materiale proprii pe categorii",
      headers: ["Categorie", "Număr"],
      rows: Object.entries(itemByCat).map(([k, v]) => [TEACHER_ITEM_CATEGORIES[k] ?? k, String(v)]),
    });
  }

  return {
    title: "Activitate profesor",
    subtitle: academicYear ? `An școlar ${academicYear}` : "Toți anii",
    filename: `activitate-profesor${academicYear ? `-${academicYear}` : ""}`,
    sections,
  };
}

// ---------- Raport anual ----------
export async function buildAnnualReport(
  teacherId: string,
  academicYear: string,
): Promise<BuiltReport> {
  const { data: journal } = await supabase
    .from("portfolio_journal")
    .select("date, title, type, description, results, next_steps, classes(display_name)")
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear)
    .eq("relevant_for_annual_report", true)
    .order("date", { ascending: true });

  const activity = await buildTeacherActivityReport(teacherId, academicYear);

  const sections: ReportSection[] = [
    ...activity.sections,
    {
      title: "Activități marcate pentru raport",
      headers: ["Data", "Titlu", "Tip", "Clasă", "Descriere", "Rezultate"],
      rows: (journal ?? []).map((j: any) => [
        dateRO(j.date),
        j.title ?? "",
        JOURNAL_TYPES[j.type] ?? j.type ?? "",
        j.classes?.display_name ?? "—",
        j.description ?? "",
        j.results ?? "",
      ]),
    },
  ];

  return {
    title: `Raport anual ${academicYear}`,
    subtitle: undefined,
    filename: `raport-anual-${academicYear}`,
    sections,
  };
}

// ---------- Export ----------
export async function exportBuiltReportPdf(r: BuiltReport) {
  await exportReportPdfSections({
    title: r.title,
    subtitle: r.subtitle,
    filename: r.filename,
    orientation: "portrait",
    sections: r.sections,
  });
}

export async function exportBuiltReportCsv(r: BuiltReport) {
  const headers: string[] = [];
  const rows: string[][] = [];
  for (const s of r.sections) {
    rows.push([`[${s.title}]`, ...s.headers.slice(1).map(() => "")]);
    rows.push(s.headers);
    rows.push(...s.rows);
    rows.push([]);
  }
  // first row defines max cols
  const maxCols = Math.max(...rows.map((r) => r.length), 1);
  const padded = rows.map((row) => {
    const out = [...row];
    while (out.length < maxCols) out.push("");
    return out;
  });
  for (let i = 0; i < maxCols; i++) headers.push(`col${i + 1}`);
  await exportToCSV(r.filename, headers, padded);
}
