import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import { downloadFileMobileSafe } from "@/lib/download";
import { formatDate } from "@/lib/time";

function stripDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0163/g, "t").replace(/\u0162/g, "T")
    .replace(/\u015f/g, "s").replace(/\u015e/g, "S")
    .replace(/\u0111/g, "d").replace(/\u0110/g, "D");
}

async function loadImageDataUrl(url: string): Promise<{ data: string; w: number; h: number }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  const dims: { w: number; h: number } = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
  return { data: dataUrl, w: dims.w, h: dims.h };
}

interface CerereTabProps {
  event: {
    id: string;
    title: string;
    date: string; // ISO yyyy-mm-dd
    start_time: string | null;
    location: string | null;
  };
  defaultPresident?: string;
}

export function CerereTab({ event, defaultPresident = "" }: CerereTabProps) {
  const [regNumber, setRegNumber] = useState("");
  const [director, setDirector] = useState("DOGARU GHEORGHE");
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(formatDate(event.date));
  const [time, setTime] = useState((event.start_time || "").slice(0, 5));
  const [location, setLocation] = useState(event.location || "");
  const [president, setPresident] = useState(defaultPresident);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setTitle(event.title);
    setDate(formatDate(event.date));
    setTime((event.start_time || "").slice(0, 5));
    setLocation(event.location || "");
  }, [event.id]);

  useEffect(() => {
    if (defaultPresident && !president) setPresident(defaultPresident);
  }, [defaultPresident]);

  const previewBody = useMemo(() => (
    <p className="text-sm leading-relaxed">
      Biroul Executiv al Consiliului Școlar al Elevilor din Colegiul Național „Cantemir-Vodă", vă adresează prezenta cerere prin care se solicită aprobarea organizării în cadrul colegiului nostru a unui eveniment cu titlul <strong>{title || "—"}</strong>.
      <br /><br />
      Propunerea este ca evenimentul să aibă loc în data de <strong>{date || "—"}</strong>, ora <strong>{time || "—"}</strong>, locația fiind <strong>{location || "—"}</strong>. Prezenți vor fi elevii care s-au înscris la eveniment prin intermediul platformei de evenimente CNCV.
    </p>
  ), [title, date, time, location]);

  async function handleExport() {
    try {
      setGenerating(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const marginL = 20;
      const marginR = 20;
      const contentW = pageW - marginL - marginR;

      // Header logos
      const [leftLogo, rightLogo] = await Promise.all([
        loadImageDataUrl("/cerere-header/consiliul-elevilor.png"),
        loadImageDataUrl("/cerere-header/cncv.png"),
      ]);
      const headerH = 22;
      const leftW = (leftLogo.w / leftLogo.h) * headerH;
      const rightW = (rightLogo.w / rightLogo.h) * headerH;
      doc.addImage(leftLogo.data, "PNG", marginL, 12, leftW, headerH);
      doc.addImage(rightLogo.data, "PNG", pageW - marginR - rightW, 12, rightW, headerH);

      // Separator
      const sepY = 12 + headerH + 4;
      doc.setLineWidth(0.4);
      doc.line(marginL, sepY, pageW - marginR, sepY);

      let y = sepY + 8;

      // R.N.E.B. Nr.
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(stripDiacritics(`R.N.E.B.   Nr. ${regNumber || "____"}`), marginL, y);
      y += 12;

      // APROB block (right aligned)
      doc.setFont("helvetica", "bold");
      const aprobLines = ["APROB,", stripDiacritics(director || ""), "DIRECTOR"];
      aprobLines.forEach((line, i) => {
        doc.text(line, pageW - marginR, y + i * 5, { align: "right" });
      });
      y += aprobLines.length * 5 + 10;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("C E R E R E", pageW / 2, y, { align: "center" });
      y += 10;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Stimate Domnule Director,", marginL, y);
      y += 8;

      // Helper: render paragraph with bold runs.
      function renderRuns(runs: { text: string; bold?: boolean }[], startY: number, indent = 0): number {
        const lineH = 6;
        const maxW = contentW - indent;
        let cursorX = marginL + indent;
        let cursorY = startY;
        const spaceWidth = (bold: boolean) => {
          doc.setFont("helvetica", bold ? "bold" : "normal");
          return doc.getTextWidth(" ");
        };
        for (const run of runs) {
          const words = stripDiacritics(run.text).split(/(\s+)/).filter(w => w.length > 0);
          for (const token of words) {
            if (/^\s+$/.test(token)) {
              cursorX += spaceWidth(!!run.bold);
              continue;
            }
            doc.setFont("helvetica", run.bold ? "bold" : "normal");
            const w = doc.getTextWidth(token);
            if (cursorX + w > marginL + indent + maxW) {
              cursorY += lineH;
              cursorX = marginL + indent;
            }
            doc.text(token, cursorX, cursorY);
            cursorX += w;
          }
        }
        return cursorY + lineH;
      }

      y = renderRuns([
        { text: "    Biroul Executiv al Consiliului Școlar al Elevilor din Colegiul Național „Cantemir-Vodă", vă adresează prezenta cerere prin care se solicită aprobarea organizării în cadrul colegiului nostru a unui eveniment cu titlul " },
        { text: title || "—", bold: true },
        { text: "." },
      ], y);
      y += 2;

      y = renderRuns([
        { text: "    Propunerea este ca evenimentul să aibă loc în data de " },
        { text: date || "—", bold: true },
        { text: ", ora " },
        { text: time || "—", bold: true },
        { text: ", locația fiind " },
        { text: location || "—", bold: true },
        { text: ". Prezenți vor fi elevii care s-au înscris la eveniment prin intermediul platformei de evenimente CNCV." },
      ], y);
      y += 6;

      y = renderRuns([
        { text: "Asigurându-vă de întreaga noastră considerație," },
      ], y);
      y = renderRuns([
        { text: "Președintele Consiliului Școlar al Elevilor Colegiului Național „Cantemir-Vodă"," },
      ], y);
      doc.setFont("helvetica", "bold");
      doc.text(stripDiacritics(president || "—"), marginL, y);

      const safeName = stripDiacritics((title || "cerere").replace(/[^a-zA-Z0-9-_]+/g, "_")).slice(0, 60);
      const pdfOutput = doc.output("datauristring");
      const base64 = pdfOutput.split(",")[1];
      await downloadFileMobileSafe(`Cerere_${safeName}_${(date || "").replace(/\./g, "-")}.pdf`, base64, "application/pdf");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>R.N.E.B. Nr.</Label>
              <Input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="ex: 27" />
            </div>
            <div className="space-y-1">
              <Label>Director</Label>
              <Input value={director} onChange={(e) => setDirector(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Titlul evenimentului</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="zz.ll.aaaa" />
            </div>
            <div className="space-y-1">
              <Label>Ora</Label>
              <Input value={time} onChange={(e) => setTime(e.target.value)} placeholder="HH:MM" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Locația</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Președintele CSE</Label>
              <Input value={president} onChange={(e) => setPresident(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4 text-sm leading-relaxed">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p>R.N.E.B.&nbsp;&nbsp;Nr. {regNumber || "____"}</p>
            </div>
            <div className="text-right font-semibold">
              <p>APROB,</p>
              <p>{director || "—"}</p>
              <p>DIRECTOR</p>
            </div>
          </div>
          <h3 className="text-center text-base font-bold tracking-widest">C E R E R E</h3>
          <p>Stimate Domnule Director,</p>
          {previewBody}
          <p>Asigurându-vă de întreaga noastră considerație,</p>
          <p>Președintele Consiliului Școlar al Elevilor Colegiului Național „Cantemir-Vodă",</p>
          <p className="font-semibold">{president || "—"}</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleExport} disabled={generating}>
          <Download className="mr-2 h-4 w-4" />
          {generating ? "Se generează..." : "Export PDF"}
        </Button>
      </div>
    </div>
  );
}
