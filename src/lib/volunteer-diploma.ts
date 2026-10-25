import jsPDF from "jspdf";
import { ensureUnicodeFont, PDF_FONT } from "@/lib/pdf-font";
import bg from "@/assets/diploma-voluntariat-bg.jpg.asset.json";

export interface DiplomaEntry { name: string; hours: number }

async function loadBg(): Promise<string> {
  const res = await fetch(bg.url);
  const blob = await res.blob();
  return await new Promise((ok, err) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = err;
    r.readAsDataURL(blob);
  });
}

export function hoursText(h: number) {
  if (h === 1) return "o oră";
  return `${h} ${h >= 20 ? "de " : ""}ore`;
}

/** Durata unei zile de voluntariat, rotunjită la ora întreagă cea mai apropiată. */
export function dayHours(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const m = (t: string) => { const [a, b] = t.split(":").map(Number); return a * 60 + (b || 0); };
  return Math.max(0, Math.round((m(end) - m(start)) / 60));
}

/** Generează un PDF A4 landscape cu câte o diplomă pe pagină. */
export async function exportVolunteerDiplomas(projectName: string, entries: DiplomaEntry[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await ensureUnicodeFont(doc);
  const img = await loadBg();
  entries.forEach((e, i) => {
    if (i > 0) doc.addPage();
    doc.addImage(img, "JPEG", 0, 0, 297, 210);

    // Nume (majuscule, vișiniu), centrat pe linie
    const name = e.name.toLocaleUpperCase("ro-RO");
    let size = 24;
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(size);
    while (doc.getTextWidth(name) > 118 && size > 12) { size -= 1; doc.setFontSize(size); }
    doc.setTextColor(106, 23, 17);
    doc.text(name, 11 + 121 / 2, 91.5, { align: "center" });

    // Paragraf
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    const p = `În semn de apreciere pentru activitatea și implicarea de care a dat dovadă în organizarea și desfășurarea evenimentului „${projectName}”, cumulând un număr de ${hoursText(e.hours)} de voluntariat.`;
    const lines = doc.splitTextToSize(p, 193);
    doc.text(lines, 11, 103, { lineHeightFactor: 1.35 });
  });
  doc.save(`Diplome-${projectName.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 50)}.pdf`);
}
