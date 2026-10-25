import { useState, useEffect } from "react";
import { useManagerSession } from "@/components/layouts/ManagerLayout";
import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase-chunk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileDown, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ensureUnicodeFont, PDF_FONT } from "@/lib/pdf-font";
import { downloadFileMobileSafe } from "@/lib/download";

const DOMAINS = [
  "Schimbări climatice",
  "Energia verde",
  "Poluare",
  "Biodiversitate",
  "Păduri și viața terestră",
  "Ape și viața acvatică",
  "Risipă alimentară",
  "Exploatarea responsabilă a resurselor naturale",
  "Managementul deșeurilor, consum și producție sustenabile",
  "Altele (specificați)",
];

const KEYWORDS: [number, string[]][] = [
  [8, ["deseu", "recicl", "reutiliz", "sustenab", "igieniz", "colectare", "plastic", "hartie"]],
  [6, ["risipa", "aliment", "hrana", "mancare"]],
  [0, ["climat", "carbon", "incalzire", "schimbari"]],
  [1, ["energ", "solar", "eolian", "verde"]],
  [2, ["polu", "aer curat", "mediu curat"]],
  [5, ["apa", "ape", "acvat", "rau", "lac", "delta", "mare"]],
  [4, ["padur", "copac", "arbor", "parc", "gradin", "plant", "botanic"]],
  [3, ["biodivers", "natur", "animal", "specii", "ecosistem"]],
  [7, ["resurse", "exploatare", "minerit"]],
];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function guessDomain(text: string): string {
  const t = norm(text);
  for (const [idx, kws] of KEYWORDS) if (kws.some((k) => t.includes(k))) return DOMAINS[idx];
  return DOMAINS[9];
}

const fmtDate = (d: string) => d.split("-").reverse().join(".");

type Row = {
  key: string;
  domeniu: string;
  nivel: string;
  denumire: string;
  elevi: string;
  cadre: string;
  parinti: string;
  comunitate: string;
  ong: string;
  alti: string;
  resurse: string;
};

const emptyRow = (): Row => ({
  key: crypto.randomUUID(), domeniu: DOMAINS[9], nivel: "", denumire: "", elevi: "0", cadre: "0",
  parinti: "0", comunitate: "0", ong: "0", alti: "0", resurse: "",
});

export default function ISMBReportPage() {
  const { sessionId, sessions } = useManagerSession();
  const session: any = sessions.find((s) => s.id === sessionId);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [unitate, setUnitate] = useState('Colegiul Național „Cantemir-Vodă”, București');
  const [judet, setJudet] = useState("București");
  const [perioada, setPerioada] = useState("");
  const [nrElevi, setNrElevi] = useState("");
  const [nrCadre, setNrCadre] = useState("");
  const [anScolar, setAnScolar] = useState("2026–2027");
  const [reusite, setReusite] = useState("");
  const [dificultati, setDificultati] = useState("");
  const [solutii, setSolutii] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [director, setDirector] = useState("");
  const [coordonator, setCoordonator] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    loadData();
  }, [sessionId]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: events } = await supabase
        .from("events")
        .select("id, title, description, location, created_by, eligible_classes, eligible_grades, date, start_time")
        .eq("session_id", sessionId)
        .in("status", ["published", "closed"])
        .order("date").order("start_time");
      const evs = events || [];
      const ids = evs.map((e) => e.id);

      const [coords, resv, pubRes, classesRes] = await Promise.all([
        ids.length ? fetchInChunks<any>(ids, 150, (c, f, t) => supabase.from("coordinator_assignments").select("event_id, teacher_id").in("event_id", c).range(f, t)) : [],
        ids.length ? fetchInChunks<any>(ids, 150, (c, f, t) => supabase.from("reservations").select("event_id, student_id").eq("status", "reserved").in("event_id", c).range(f, t)) : [],
        ids.length ? fetchInChunks<any>(ids, 150, (c, f, t) => supabase.from("public_reservations").select("id, event_id").eq("status", "reserved").in("event_id", c).range(f, t)) : [],
        supabase.from("classes").select("id, grade_number"),
      ]);
      const gradeById = Object.fromEntries((classesRes.data || []).map((c: any) => [c.id, c.grade_number]));

      const pubIds = (pubRes as any[]).map((r) => r.id);
      const pubTickets = pubIds.length
        ? await fetchInChunks<any>(pubIds, 150, (c, f, t) => supabase.from("public_tickets").select("public_reservation_id").neq("status", "cancelled").in("public_reservation_id", c).range(f, t))
        : [];
      const pubEvent = Object.fromEntries((pubRes as any[]).map((r) => [r.id, r.event_id]));

      const students: Record<string, Set<string>> = {};
      const allStudents = new Set<string>();
      (resv as any[]).forEach((r) => { (students[r.event_id] ||= new Set()).add(r.student_id); allStudents.add(r.student_id); });
      const visitors: Record<string, number> = {};
      pubTickets.forEach((t: any) => { const e = pubEvent[t.public_reservation_id]; visitors[e] = (visitors[e] || 0) + 1; });

      const teachers: Record<string, Set<string>> = {};
      const allTeachers = new Set<string>();
      evs.forEach((e) => { if (e.created_by) { (teachers[e.id] ||= new Set()).add(e.created_by); allTeachers.add(e.created_by); } });
      (coords as any[]).forEach((c) => { (teachers[c.event_id] ||= new Set()).add(c.teacher_id); allTeachers.add(c.teacher_id); });

      const nivel = (e: any) => {
        let grades: number[] = (e.eligible_classes || []).map((c: string) => gradeById[c]).filter(Boolean);
        if (!grades.length) grades = e.eligible_grades || [];
        if (!grades.length) return "Gimnaziu și liceu";
        const g = grades.some((x) => x <= 8), l = grades.some((x) => x >= 9);
        return g && l ? "Gimnaziu și liceu" : g ? "Gimnaziu" : "Liceu";
      };

      const built: Row[] = evs.map((e) => {
        const desc = (e.description || "").replace(/\s+/g, " ").trim();
        return {
          ...emptyRow(),
          domeniu: guessDomain(`${e.title} ${desc}`),
          nivel: nivel(e),
          denumire: desc ? `${e.title} – ${desc.length > 200 ? desc.slice(0, 200) + "…" : desc}` : e.title,
          elevi: String((students[e.id]?.size || 0) + (visitors[e.id] || 0)),
          cadre: String(teachers[e.id]?.size || 0),
          resurse: e.location || "",
        };
      });
      built.sort((a, b) => DOMAINS.indexOf(a.domeniu) - DOMAINS.indexOf(b.domeniu));
      setRows(built);

      setPerioada(session ? `${fmtDate(session.start_date)} – ${fmtDate(session.end_date)}` : "");
      if (session?.academic_year) setAnScolar(session.academic_year);
      setNrElevi(String(allStudents.size + pubTickets.length));
      setNrCadre(String(allTeachers.size));
      setReusite(`- Afirmarea spiritului civic al elevilor alături de cadrele didactice
- Stimularea gândirii creative, a spiritului critic, a lucrului în echipă și a abilităților de comunicare
- Conștientizarea problemelor de mediu și implicarea elevilor în comunitate
- Capacitatea de a atrage parteneri
- ${evs.length} activități derulate, cu tematici diverse`);
      setDificultati(`- Costurile deplasărilor pentru activitățile din afara Colegiului
- Riscurile privind siguranța elevilor în activitățile din afara Colegiului
- Resursele insuficiente`);
      setSolutii(`- Asigurarea continuității în anii următori, prin atragerea de noi parteneri
- Crearea unor parteneriate cu instituții culturale și de mediu
- Promovarea constantă a ofertelor educaționale de educație ecologică`);
    } catch (err) {
      console.error(err);
      toast.error("Eroare la încărcarea datelor");
    } finally {
      setLoading(false);
    }
  }

  const updateRow = (key: string, field: keyof Row, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  async function exportPdf() {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      await ensureUnicodeFont(doc);
      const pageW = 210;
      let y = 14;
      doc.setFontSize(8);
      doc.text("INSPECTORATUL ȘCOLAR AL MUNICIPIULUI BUCUREȘTI • DIALOGUL PROIECTELOR EDUCATIVE " + anScolar, pageW / 2, y, { align: "center" });
      y += 9;
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(14);
      doc.text("MODEL DE RAPORTARE „SĂPTĂMÂNA VERDE”", pageW / 2, y, { align: "center" });
      y += 6;

      const common = { styles: { font: PDF_FONT, fontSize: 9, cellPadding: 2, valign: "top" as const }, theme: "grid" as const };
      const lbl = { fontStyle: "bold" as const, fillColor: [240, 240, 240] as [number, number, number] };
      autoTable(doc, {
        ...common,
        startY: y,
        columnStyles: { 0: { cellWidth: 55 }, 2: { cellWidth: 45 } },
        body: [
          [{ content: "1. Unitatea de învățământ și localitatea", styles: lbl }, unitate, { content: "2. Județul", styles: lbl }, judet],
          [{ content: "3. Perioada de desfășurare a Programului „Săptămâna verde”", styles: lbl }, perioada, { content: "4. Nr. total elevi / preșcolari", styles: lbl }, nrElevi],
          [{ content: "5. Nr. total cadre didactice", styles: lbl }, nrCadre, { content: "An școlar", styles: lbl }, anScolar],
          [{ content: "6. Reușite / puncte tari ale activităților", styles: lbl }, { content: reusite, colSpan: 3 }],
          [{ content: "7. Dificultăți / puncte slabe", styles: lbl }, { content: dificultati, colSpan: 3 }],
          [{ content: "8. Soluții / oportunități identificate", styles: lbl }, { content: solutii, colSpan: 3 }],
        ],
      });

      doc.addPage("a4", "landscape");
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(12);
      doc.text("Centralizator activități – „Săptămâna verde”", 148.5, 14, { align: "center" });
      autoTable(doc, {
        ...common,
        startY: 19,
        styles: { ...common.styles, fontSize: 8 },
        headStyles: { font: PDF_FONT, fontStyle: "bold", fillColor: [122, 31, 46], halign: "center", valign: "middle" },
        head: [
          [
            { content: "DOMENII", rowSpan: 2 }, { content: "NIVEL DE ÎNVĂȚĂMÂNT", rowSpan: 2 },
            { content: "DENUMIREA / DESCRIEREA ACTIVITĂȚII", rowSpan: 2 }, { content: "NR. ELEVI / PREȘCOLARI", rowSpan: 2 },
            { content: "NR. CADRE DIDACTICE", rowSpan: 2 }, { content: "NR. PARTENERI", colSpan: 4 },
            { content: "RESURSE UTILIZATE", rowSpan: 2 },
          ],
          ["PĂRINȚI / REPREZ. LEGALI", "COMUNITATEA LOCALĂ", "ONG-URI", "ALȚI PARTENERI"],
        ],
        columnStyles: {
          0: { cellWidth: 38 }, 1: { cellWidth: 22 }, 2: { cellWidth: 75 }, 3: { cellWidth: 17, halign: "center" },
          4: { cellWidth: 17, halign: "center" }, 5: { cellWidth: 18, halign: "center" }, 6: { cellWidth: 18, halign: "center" },
          7: { cellWidth: 15, halign: "center" }, 8: { cellWidth: 18, halign: "center" },
        },
        body: rows.map((r) => [r.domeniu, r.nivel, r.denumire, r.elevi, r.cadre, r.parinti, r.comunitate, r.ong, r.alti, r.resurse]),
      });
      let fy = (doc as any).lastAutoTable.finalY + 6;
      if (fy > 180) { doc.addPage("a4", "landscape"); fy = 20; }
      doc.setFont(PDF_FONT, "normal");
      doc.setFontSize(8);
      doc.text("Notă: se completează câte un rând pentru fiecare activitate relevantă; pentru același domeniu se pot adăuga rânduri suplimentare.", 14, fy);
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(10);
      doc.text(`Director, ${director || "____________________"}`, 14, fy + 12);
      doc.text(`Coordonator program, ${coordonator || "____________________"}`, 160, fy + 12);

      const base64 = doc.output("datauristring").split(",")[1];
      await downloadFileMobileSafe("raport_ismb_saptamana_verde.pdf", base64, "application/pdf");
      toast.success("PDF exportat cu succes");
    } catch (err) {
      console.error(err);
      toast.error("Eroare la exportul PDF");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const field = (label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold">{label}</label>
      <Input value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );
  const area = (label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold">{label}</label>
      <Textarea value={value} onChange={(e) => set(e.target.value)} rows={5} className="text-sm" />
    </div>
  );
  const cell = "h-8 text-xs px-2";

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold">Raport ISMB — „Săptămâna verde”</h1>
        <Button onClick={exportPdf} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
          Exportă PDF
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Date generale</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {field("1. Unitatea de învățământ și localitatea", unitate, setUnitate)}
          {field("2. Județul", judet, setJudet)}
          {field("3. Perioada de desfășurare", perioada, setPerioada)}
          {field("4. Nr. total elevi / preșcolari", nrElevi, setNrElevi)}
          {field("5. Nr. total cadre didactice", nrCadre, setNrCadre)}
          {field("An școlar", anScolar, setAnScolar)}
          <div className="md:col-span-2 space-y-3">
            {area("6. Reușite / puncte tari ale activităților", reusite, setReusite)}
            {area("7. Dificultăți / puncte slabe", dificultati, setDificultati)}
            {area("8. Soluții / oportunități identificate", solutii, setSolutii)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Centralizator activități ({rows.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, emptyRow()])}><Plus className="h-4 w-4 mr-1" />Adaugă rând</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[1300px]">
            <thead>
              <tr className="bg-muted">
                {["Domeniu", "Nivel", "Denumire / descriere", "Elevi", "Cadre did.", "Părinți", "Comunitate", "ONG-uri", "Alți part.", "Resurse", ""].map((h) => (
                  <th key={h} className="border p-1 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="align-top">
                  <td className="border p-1 w-56">
                    <select className="w-full h-8 rounded-md border bg-background text-xs px-1" value={r.domeniu} onChange={(e) => updateRow(r.key, "domeniu", e.target.value)}>
                      {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="border p-1 w-32">
                    <select className="w-full h-8 rounded-md border bg-background text-xs px-1" value={r.nivel} onChange={(e) => updateRow(r.key, "nivel", e.target.value)}>
                      {["", "Gimnaziu", "Liceu", "Gimnaziu și liceu"].map((d) => <option key={d} value={d}>{d || "—"}</option>)}
                    </select>
                  </td>
                  <td className="border p-1"><Textarea className="text-xs min-h-[60px]" value={r.denumire} onChange={(e) => updateRow(r.key, "denumire", e.target.value)} /></td>
                  {(["elevi", "cadre", "parinti", "comunitate", "ong", "alti"] as const).map((f) => (
                    <td key={f} className="border p-1 w-20"><Input className={cell} value={r[f]} onChange={(e) => updateRow(r.key, f, e.target.value)} /></td>
                  ))}
                  <td className="border p-1 w-48"><Textarea className="text-xs min-h-[60px]" value={r.resurse} onChange={(e) => updateRow(r.key, "resurse", e.target.value)} /></td>
                  <td className="border p-1 w-10">
                    <Button size="icon" variant="ghost" aria-label="Șterge rândul" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Semnături</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {field("Director", director, setDirector)}
          {field("Coordonator program", coordonator, setCoordonator)}
        </CardContent>
      </Card>
    </div>
  );
}
