import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Download, RotateCcw } from "lucide-react";
import { downloadFileMobileSafe } from "@/lib/download";
import { formatDate } from "@/lib/time";

const DEFAULT_INTRO =
  "Biroul Executiv al Consiliului Școlar al Elevilor din Colegiul Național „Cantemir-Vodă\", vă adresează prezenta cerere prin care se solicită aprobarea organizării în cadrul colegiului nostru a unui eveniment cu titlul {titlu}.";

const DEFAULT_BODY =
  "Propunerea este ca evenimentul să aibă loc în data de {data}, ora {ora}, locația fiind {locatie}. Prezenți vor fi elevii care s-au înscris la eveniment prin intermediul platformei de evenimente CNCV.";

const DEFAULT_CLOSING =
  "Asigurându-vă de întreaga noastră considerație,\nPreședintele Consiliului Școlar al Elevilor Colegiului Național „Cantemir-Vodă\",\n{presedinte}";

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

type Run = { text: string; bold?: boolean };

/**
 * Sparte textul în runs pe baza placeholderelor {key}.
 * Valorile placeholderelor devin runs bold; restul rămâne normal.
 */
function tokenize(template: string, values: Record<string, string>): Run[] {
  const regex = /\{([a-zA-Z_]+)\}/g;
  const runs: Run[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ text: template.slice(lastIndex, match.index) });
    }
    const key = match[1];
    const value = values[key] ?? `{${key}}`;
    runs.push({ text: value || "—", bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < template.length) {
    runs.push({ text: template.slice(lastIndex) });
  }
  return runs;
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
  const [introText, setIntroText] = useState(DEFAULT_INTRO);
  const [bodyText, setBodyText] = useState(DEFAULT_BODY);
  const [closingText, setClosingText] = useState(DEFAULT_CLOSING);
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

  const values = useMemo<Record<string, string>>(() => ({
    titlu: title,
    data: date,
    ora: time,
    locatie: location,
    presedinte: president,
    director,
  }), [title, date, time, location, president, director]);

  const introRuns = useMemo(() => tokenize(introText, values), [introText, values]);
  const bodyRuns = useMemo(() => tokenize(bodyText, values), [bodyText, values]);
  const closingLines = useMemo(
    () => closingText.split("\n").map((line) => tokenize(line, values)),
    [closingText, values],
  );

  function resetTexts() {
    setIntroText(DEFAULT_INTRO);
    setBodyText(DEFAULT_BODY);
    setClosingText(DEFAULT_CLOSING);
  }

  async function handleExport() {
    try {
      setGenerating(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const marginL = 20;
      const marginR = 20;
      const contentW = pageW - marginL - marginR;

      const [leftLogo, rightLogo] = await Promise.all([
        loadImageDataUrl("/cerere-header/consiliul-elevilor.png"),
        loadImageDataUrl("/cerere-header/cncv.png"),
      ]);
      const headerH = 22;
      const leftW = (leftLogo.w / leftLogo.h) * headerH;
      const rightW = (rightLogo.w / rightLogo.h) * headerH;
      doc.addImage(leftLogo.data, "PNG", marginL, 12, leftW, headerH);
      doc.addImage(rightLogo.data, "PNG", pageW - marginR - rightW, 12, rightW, headerH);

      const sepY = 12 + headerH + 4;
      doc.setLineWidth(0.4);
      doc.line(marginL, sepY, pageW - marginR, sepY);

      let y = sepY + 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(stripDiacritics(`R.N.E.B.   Nr. ${regNumber || "____"}`), marginL, y);
      y += 12;

      doc.setFont("helvetica", "bold");
      const aprobLines = ["APROB,", stripDiacritics(director || ""), "DIRECTOR"];
      aprobLines.forEach((line, i) => {
        doc.text(line, pageW - marginR, y + i * 5, { align: "right" });
      });
      y += aprobLines.length * 5 + 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("C E R E R E", pageW / 2, y, { align: "center" });
      y += 10;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Stimate Domnule Director,", marginL, y);
      y += 8;

      function renderRuns(runs: Run[], startY: number, indent = 0): number {
        const lineH = 6;
        const maxW = contentW - indent;
        let cursorX = marginL + indent;
        let cursorY = startY;
        const spaceWidth = (bold: boolean) => {
          doc.setFont("helvetica", bold ? "bold" : "normal");
          return doc.getTextWidth(" ");
        };
        for (const run of runs) {
          const tokens = stripDiacritics(run.text).split(/(\s+)/).filter((w) => w.length > 0);
          for (const token of tokens) {
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

      // Indent paragraphs with 4-space prefix
      const introWithIndent: Run[] = [{ text: "    " }, ...introRuns];
      const bodyWithIndent: Run[] = [{ text: "    " }, ...bodyRuns];

      y = renderRuns(introWithIndent, y);
      y += 2;
      y = renderRuns(bodyWithIndent, y);
      y += 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);

      function renderCenteredRuns(runs: Run[], startY: number): number {
        // Compute full width by concatenating text, render centered as one line (wrap if needed).
        const fullText = stripDiacritics(runs.map((r) => r.text).join(""));
        const wrapped = doc.splitTextToSize(fullText, contentW);
        let cy = startY;
        for (const w of wrapped) {
          doc.text(w, pageW / 2, cy, { align: "center" });
          cy += 6;
        }
        return cy;
      }

      for (const lineRuns of closingLines) {
        if (lineRuns.length === 0) {
          y += 6;
          continue;
        }
        y = renderCenteredRuns(lineRuns, y);
      }

      const safeName = stripDiacritics((title || "cerere").replace(/[^a-zA-Z0-9-_]+/g, "_")).slice(0, 60);
      const pdfOutput = doc.output("datauristring");
      const base64 = pdfOutput.split(",")[1];
      await downloadFileMobileSafe(`Cerere_${safeName}_${(date || "").replace(/\./g, "-")}.pdf`, base64, "application/pdf");
    } finally {
      setGenerating(false);
    }
  }

  function renderPreviewRuns(runs: Run[]) {
    return runs.map((r, i) => (
      r.bold ? <strong key={i}>{r.text}</strong> : <span key={i}>{r.text}</span>
    ));
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
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Conținutul cererii</h4>
              <p className="text-xs text-muted-foreground">
                Poți edita textul. Folosește <code>{"{titlu}"}</code>, <code>{"{data}"}</code>, <code>{"{ora}"}</code>, <code>{"{locatie}"}</code>, <code>{"{presedinte}"}</code>, <code>{"{director}"}</code> pentru a insera automat valorile din formular.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={resetTexts}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Resetează
            </Button>
          </div>

          <div className="space-y-1">
            <Label>Paragraf introductiv</Label>
            <Textarea rows={4} value={introText} onChange={(e) => setIntroText(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Paragraf propunere</Label>
            <Textarea rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Formula de încheiere</Label>
            <Textarea rows={4} value={closingText} onChange={(e) => setClosingText(e.target.value)} />
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
          <p className="indent-8">{renderPreviewRuns(introRuns)}</p>
          <p className="indent-8">{renderPreviewRuns(bodyRuns)}</p>
          <div className="space-y-1 text-center font-bold">
            {closingLines.map((lineRuns, i) => (
              <p key={i}>{renderPreviewRuns(lineRuns)}</p>
            ))}
          </div>
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
