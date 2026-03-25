import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFileMobileSafe } from "./download";

function stripDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0163/g, "t").replace(/\u0162/g, "T")
    .replace(/\u015f/g, "s").replace(/\u015e/g, "S")
    .replace(/\u0111/g, "d").replace(/\u0110/g, "D");
}

const romanValues: Record<string, number> = {
  I: 1, V: 5, X: 10, L: 50, C: 100,
};

function romanToInt(s: string): number {
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = romanValues[s[i]] || 0;
    const next = romanValues[s[i + 1]] || 0;
    result += cur < next ? -cur : cur;
  }
  return result;
}

/** Sort class names like "V A", "IX B", "XII C" by grade number then section */
function compareClassName(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  // Extract roman numeral prefix and section suffix
  const re = /^([IVXLC]+)\s*(.*)$/i;
  const ma = a.match(re);
  const mb = b.match(re);
  if (!ma && !mb) return a.localeCompare(b, "ro");
  if (!ma) return 1;
  if (!mb) return -1;
  const gradeA = romanToInt(ma[1].toUpperCase());
  const gradeB = romanToInt(mb[1].toUpperCase());
  if (gradeA !== gradeB) return gradeA - gradeB;
  return (ma[2] || "").localeCompare(mb[2] || "", "ro");
}

interface ParticipantRow {
  name: string;
  className?: string;
  identifier?: string;
  status: string;
  isPublic: boolean;
  checkinTimestamp?: string | null;
}

const statusLabels: Record<string, string> = {
  reserved: "Rezervat", present: "Prezent", late: "Intarziat",
  absent: "Absent", excused: "Motivat", cancelled: "Anulat",
};

export async function exportAttendancePdf(
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  eventLocation: string | null,
  participants: ParticipantRow[],
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const safeTitle = stripDiacritics(eventTitle);

  // Sort by class then by name
  const sorted = [...participants].sort((a, b) => {
    const classCmp = compareClassName(a.className || "", b.className || "");
    if (classCmp !== 0) return classCmp;
    return (a.name || "").localeCompare(b.name || "", "ro");
  });

  // Header
  doc.setFontSize(16);
  doc.text(stripDiacritics("Lista de prezenta"), 105, 15, { align: "center" });
  doc.setFontSize(11);
  doc.text(safeTitle, 105, 23, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Data: ${eventDate}  |  Ora: ${eventTime}${eventLocation ? `  |  Locatie: ${stripDiacritics(eventLocation)}` : ""}`, 105, 30, { align: "center" });

  const totalP = sorted.length;
  const present = sorted.filter(p => p.status === "present").length;
  const late = sorted.filter(p => p.status === "late").length;
  const absent = sorted.filter(p => p.status === "absent").length;
  const excused = sorted.filter(p => p.status === "excused").length;
  const reserved = sorted.filter(p => p.status === "reserved").length;

  doc.setFontSize(8);
  doc.text(
    `Total: ${totalP}  |  Prezenti: ${present}  |  Intarziati: ${late}  |  Absenti: ${absent}  |  Motivati: ${excused}  |  Asteptati: ${reserved}`,
    105, 36, { align: "center" }
  );

  // Table
  const rows = sorted.map((p, i) => [
    String(i + 1),
    stripDiacritics(p.className || "-"),
    stripDiacritics(p.name),
    p.identifier || "-",
    statusLabels[p.status] || p.status,
    p.isPublic ? "Vizitator" : "Elev",
    p.checkinTimestamp ? new Date(p.checkinTimestamp).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : "-",
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["Nr.", "Clasa", "Nume", "Identificator", "Status", "Tip", "Check-in"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 65, 122], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 20 },
      2: { cellWidth: 50 },
      3: { cellWidth: 25 },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 20, halign: "center" },
      6: { cellWidth: 20, halign: "center" },
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  const filename = `prezenta-${safeTitle.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  const pdfOutput = doc.output("datauristring");
  const base64Data = pdfOutput.split(",")[1];
  await downloadFileMobileSafe(filename, base64Data, "application/pdf");
}

// --- Simplified attendance PDF for admin (Nr., Clasa, Nume si Prenume, Status) ---

interface SimpleAttendanceRow {
  className: string;
  fullName: string;
  status: "Prezent" | "Absent motivat" | "Absent";
}

function isAbsentStatus(status: string): boolean {
  return status === "Absent" || status === "Absent motivat";
}

export async function exportSimpleAttendancePdf(
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  eventLocation: string | null,
  rows: SimpleAttendanceRow[],
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const safeTitle = stripDiacritics(eventTitle);

  // Sort by class then by name
  const sorted = [...rows].sort((a, b) => {
    const classCmp = compareClassName(a.className || "", b.className || "");
    if (classCmp !== 0) return classCmp;
    return (a.fullName || "").localeCompare(b.fullName || "", "ro");
  });

  // Header
  doc.setFontSize(16);
  doc.text(stripDiacritics("Lista de prezenta"), 105, 15, { align: "center" });
  doc.setFontSize(11);
  doc.text(safeTitle, 105, 23, { align: "center" });
  doc.setFontSize(9);
  doc.text(
    `Data: ${eventDate}  |  Ora: ${eventTime}${eventLocation ? `  |  Locatie: ${stripDiacritics(eventLocation)}` : ""}`,
    105, 30, { align: "center" },
  );

  // Stats
  const total = sorted.length;
  const prezenti = sorted.filter(r => r.status === "Prezent").length;
  const absentMotivat = sorted.filter(r => r.status === "Absent motivat").length;
  const absenti = sorted.filter(r => r.status === "Absent").length;

  doc.setFontSize(8);
  doc.text(
    `Total: ${total}  |  Prezenti: ${prezenti}  |  Absent motivat: ${absentMotivat}  |  Absenti: ${absenti}`,
    105, 36, { align: "center" },
  );

  // Table
  const tableRows = sorted.map((r, i) => [
    String(i + 1),
    stripDiacritics(r.className),
    stripDiacritics(r.fullName),
    r.status,
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["Nr.", "Clasa", "Nume si Prenume", "Status"]],
    body: tableRows,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [41, 65, 122], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 30 },
      2: { cellWidth: 80 },
      3: { cellWidth: 35, halign: "center" },
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  const filename = `prezenta-${safeTitle.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  const pdfOutput = doc.output("datauristring");
  const base64Data = pdfOutput.split(",")[1];
  await downloadFileMobileSafe(filename, base64Data, "application/pdf");
}
