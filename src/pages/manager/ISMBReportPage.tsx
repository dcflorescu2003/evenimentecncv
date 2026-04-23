import { useState, useEffect } from "react";
import { useManagerSession } from "@/components/layouts/ManagerLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { downloadFileMobileSafe } from "@/lib/download";

function stripDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0163/g, "t").replace(/\u0162/g, "T")
    .replace(/\u015f/g, "s").replace(/\u015e/g, "S")
    .replace(/\u0111/g, "d").replace(/\u0110/g, "D");
}

function formatDateRo(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
}

export default function ISMBReportPage() {
  const { sessionId, sessionName, sessions } = useManagerSession();
  const session = sessions.find((s) => s.id === sessionId);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Editable sections
  const [descriere, setDescriere] = useState("");
  const [tipActivitati, setTipActivitati] = useState("");
  const [participanti, setParticipanti] = useState("");
  const [parteneri, setParteneri] = useState("");
  const [spatii, setSpatii] = useState("");
  const [rezultate, setRezultate] = useState("");
  const [swot, setSwot] = useState("");
  const [recomandari, setRecomandari] = useState("");
  const [semnaturi, setSemnaturi] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    loadData();
  }, [sessionId]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch events for this session
      const { data: events } = await supabase
        .from("events")
        .select("id, location, title")
        .eq("session_id", sessionId)
        .in("status", ["published", "closed"]);

      const eventCount = events?.length || 0;
      const eventIds = events?.map((e) => e.id) || [];

      // Distinct locations
      const locations = [...new Set((events || []).map((e) => e.location).filter(Boolean))];

      // Teacher count
      let teacherCount = 0;
      if (eventIds.length > 0) {
        const { data: coords } = await supabase
          .from("coordinator_assignments")
          .select("teacher_id")
          .in("event_id", eventIds);
        const uniqueTeachers = new Set((coords || []).map((c) => c.teacher_id));
        teacherCount = uniqueTeachers.size;
      }

      // Student count (reservations)
      let studentCount = 0;
      if (eventIds.length > 0) {
        const { data: reservations } = await supabase
          .from("reservations")
          .select("student_id")
          .in("event_id", eventIds)
          .eq("status", "reserved");
        const uniqueStudents = new Set((reservations || []).map((r) => r.student_id));
        studentCount = uniqueStudents.size;
      }

      // Public tickets count
      if (eventIds.length > 0) {
        const { data: pubRes } = await supabase
          .from("public_reservations")
          .select("id")
          .in("event_id", eventIds)
          .eq("status", "reserved");
        const pubResIds = (pubRes || []).map((r) => r.id);
        if (pubResIds.length > 0) {
          const { data: pubTickets } = await supabase
            .from("public_tickets")
            .select("id")
            .in("public_reservation_id", pubResIds)
            .neq("status", "cancelled");
          studentCount += pubTickets?.length || 0;
        }
      }

      const periodStr = session
        ? `${formatDateRo(session.start_date)} - ${formatDateRo(session.end_date)}`
        : "...";

      // Pre-populate sections
      setDescriere(
        `În Colegiul Național Cantemir-Vodă săptămâna Școala Altfel s-a derulat în perioada ${periodStr} și a inclus ${eventCount} activități cu specific și tematici diverse: activități cultural-artistice, creative, sportive, ateliere practice interdisciplinare, sesiuni științifico-creative, dezbateri, vizite la facultăți, firme IT, instituții culturale sau profesionale publice sau private (în scopuri de orientare profesională), jocuri colaborative, tururi ghidate, campanii și ateliere pentru prevenirea violenței și a consumului de substanțe, vizionări de filme și piese de teatru, excursii tematice. Descrierea detaliată a activităților desfășurate, obiectivelor urmărite, analiza rezultatelor etc, se găsesc în anexele prezentului raport (fișele de activitate completate de profesorii coordonatori).`
      );

      setTipActivitati(
        `Cultural artistice, ateliere științifico-creative, vizionări de filme artistice sau documentare și piese de teatru, vizite de orientare profesională la instituții publice și private, activități sportive, ateliere practice interdisciplinare, dezbateri (pe diverse teme, inclusiv despre bullying, violență, consumul de droguri și traficul de persoane), tururi ghidate, jocuri colaborative, excursii tematice.`
      );

      setParticipanti(
        `- Cadre didactice: ${teacherCount}\n- Elevi: ${studentCount}`
      );

      setParteneri(
        `Biblioteca Metropolitană „Dimitrie Cantemir", Poliția Română, Universitatea Politehnica, Liga studenților din Facultatea de Medicină, Universitatea de Medicină și Farmacie Carol Davila, Muzeul Național Cotroceni, Muzeul Pompierilor, Muzeul Anton Pann, BNR, Muzeul Theodor Aman, Muzeul Peleș (Sinaia), Monetaria Statului, Muzeul Național de Artă, Biblioteca Centrală Universitară Carol I`
      );

      setSpatii(
        locations.length > 0
          ? `Col. Național „Cantemir-Vodă", ${locations.join(", ")}`
          : `Col. Național „Cantemir-Vodă"`
      );

      setRezultate(
        `a. Conștientizarea cauzelor și efectelor violenței și consumului de substanțe
b. Implicarea elevilor în problemele comunității din care fac parte
c. Dezvoltarea simțului civic
d. O mai bună autoanaliză și autoconștientizare
e. Dezvoltarea creativității
f. O puternică motivare a elevilor din liceu pentru participarea la activități culturale, științifice și educative
g. Implicarea elevilor în activități de fixare a informațiilor acumulate și activități de cercetare și experimentare
h. Orientare profesională`
      );

      setSwot(
        `Puncte tari:
- Afirmarea spiritului civic al elevilor alături de cadrele didactice ca factori activi la viața cultural-artistică a cetății
- Stimularea gândirii creative, a interesului pentru evenimentele culturale ale comunității, a spiritului critic, a lucrului în echipă și a abilităților de comunicare formală și non-formală
- Perfecționarea unor strategii didactice pentru creșterea calității învățământului preuniversitar
- Stimularea gândirii creative, a interesului pentru cucerile științifice ale societății
- Capacitatea de a atrage parteneri

Puncte slabe:
- Costurile deplasărilor pentru realizarea activităților din afara Colegiului
- Riscurile existente pentru asigurarea siguranței elevilor în realizarea activităților din afara Colegiului

Oportunități:
- Asigurarea continuității în anii următori, prin atragerea de noi parteneri
- Exersarea corectă a normelor/regulilor de comportare civilizată, în spațiul privat și public
- Promovarea constantă a ofertelor cultural-artistice și experimental-științifice

Amenințări:
- Resursele insuficiente`
      );

      setRecomandari(
        `a. Alocarea unor fonduri speciale la nivel local pentru realizarea activităților extrașcolare mai ales pentru categoriile de elevi provenite din mediile paupere sau având diverse dizabilități și a căror deplasare implică costuri deosebite.
b. Crearea unor parteneriate între principalele instituții culturale și școală care să înlesnească accesul elevilor la actul cultural-artistic și extrașcolar.`
      );

      setSemnaturi(
        `Nume și prenume Director / Semnătura
Prof. ___________________________

Nume și prenume Consilier educativ / Semnătura
Prof. ___________________________

Nume și prenume Coordonator CEAC / Semnătura
Prof. ___________________________`
      );
    } catch (err) {
      console.error(err);
      toast.error("Eroare la încărcarea datelor");
    } finally {
      setLoading(false);
    }
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const marginL = 15;
      const marginR = 15;
      const contentW = pageW - marginL - marginR;
      let y = 15;

      function checkPage(needed: number) {
        if (y + needed > 280) {
          doc.addPage();
          y = 15;
        }
      }

      function writeTitle(text: string) {
        checkPage(12);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        const lines = doc.splitTextToSize(stripDiacritics(text), contentW);
        doc.text(lines, marginL, y);
        y += lines.length * 5 + 3;
      }

      function writeBody(text: string) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(stripDiacritics(text), contentW);
        for (const line of lines) {
          checkPage(5);
          doc.text(line, marginL, y);
          y += 4.5;
        }
        y += 3;
      }

      // Header
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const headerLine = stripDiacritics('Colegiul Național „CANTEMIR-VODĂ"');
      doc.text(headerLine, pageW / 2, y, { align: "center" });
      y += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(stripDiacritics("Str. Viitorului, nr. 60, sector 2, București"), pageW / 2, y, { align: "center" });
      y += 5;
      doc.text(stripDiacritics("Nr. de înregistrare ............../.................................."), pageW / 2, y, { align: "center" });
      y += 10;

      // Title
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      const mainTitle = stripDiacritics("Raport final asupra activităților din Săptămâna Școala Altfel");
      const titleLines = doc.splitTextToSize(mainTitle, contentW);
      doc.text(titleLines, pageW / 2, y, { align: "center" });
      y += titleLines.length * 6 + 6;

      // Sections
      writeBody(descriere);

      y += 2;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(stripDiacritics("Situația centralizată se prezintă astfel:"), marginL, y);
      y += 7;

      writeTitle("1. Numărul total de activități derulate:");
      writeBody(descriere.match(/(\d+) activit/)?.[1] + " activități" || "—");

      writeTitle("2. Tipul activităților:");
      writeBody(tipActivitati);

      writeTitle("3. Participanți:");
      writeBody(participanti);

      writeTitle("4. Parteneri implicați:");
      writeBody(parteneri);

      writeTitle("5. Spațiile de desfășurare a activităților:");
      writeBody(spatii);

      writeTitle("6. Rezultate înregistrate:");
      writeBody(rezultate);

      writeTitle("7. Analiza SWOT:");
      writeBody(swot);

      writeTitle("8. Recomandări, sugestii:");
      writeBody(recomandari);

      // Signatures
      y += 10;
      writeBody(semnaturi);

      const pdfOutput = doc.output("datauristring");
      const base64Data = pdfOutput.split(",")[1];
      await downloadFileMobileSafe("raport_ismb.pdf", base64Data, "application/pdf");
      toast.success("PDF exportat cu succes");
    } catch (err) {
      console.error(err);
      toast.error("Eroare la exportul PDF");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sections: { label: string; value: string; setter: (v: string) => void; rows?: number }[] = [
    { label: "1. Descriere generală", value: descriere, setter: setDescriere, rows: 8 },
    { label: "2. Tipul activităților", value: tipActivitati, setter: setTipActivitati, rows: 4 },
    { label: "3. Participanți", value: participanti, setter: setParticipanti, rows: 3 },
    { label: "4. Parteneri implicați", value: parteneri, setter: setParteneri, rows: 4 },
    { label: "5. Spații de desfășurare", value: spatii, setter: setSpatii, rows: 4 },
    { label: "6. Rezultate înregistrate", value: rezultate, setter: setRezultate, rows: 8 },
    { label: "7. Analiza SWOT", value: swot, setter: setSwot, rows: 14 },
    { label: "8. Recomandări, sugestii", value: recomandari, setter: setRecomandari, rows: 4 },
    { label: "Semnături", value: semnaturi, setter: setSemnaturi, rows: 6 },
  ];

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold">Raport ISMB — {sessionName}</h1>
        <Button onClick={exportPdf} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
          Exportă PDF
        </Button>
      </div>

      {sections.map((sec) => (
        <Card key={sec.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{sec.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={sec.value}
              onChange={(e) => sec.setter(e.target.value)}
              rows={sec.rows || 4}
              className="text-sm"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
