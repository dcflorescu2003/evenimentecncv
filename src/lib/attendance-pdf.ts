import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function stripDiacritics(str: string): string {
  return str
    .replace(/[ăâ]/g, "a").replace(/[ĂÂ]/g, "A")
    .replace(/[îÎ]/g, "i")
    .replace(/[șş]/g, "s").replace(/[ȘŞ]/g, "S")
    .replace(/[țţ]/g, "t").replace(/[ȚŢ]/g, "T");
}

interface ParticipantRow {
  name: string;
  identifier?: string;
  status: string;
  isPublic: boolean;
  checkinTimestamp?: string | null;
}

const statusLabels: Record<string, string> = {
  reserved: "Rezervat", present: "Prezent", late: "Intarziat",
  absent: "Absent", excused: "Motivat", cancelled: "Anulat",
};

export function exportAttendancePdf(
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  eventLocation: string | null,
  participants: ParticipantRow[],
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const safeTitle = stripDiacritics(eventTitle);

  // Header
  doc.setFontSize(16);
  doc.text(stripDiacritics("Lista de prezenta"), 105, 15, { align: "center" });
  doc.setFontSize(11);
  doc.text(safeTitle, 105, 23, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Data: ${eventDate}  |  Ora: ${eventTime}${eventLocation ? `  |  Locatie: ${stripDiacritics(eventLocation)}` : ""}`, 105, 30, { align: "center" });

  const totalP = participants.length;
  const present = participants.filter(p => p.status === "present").length;
  const late = participants.filter(p => p.status === "late").length;
  const absent = participants.filter(p => p.status === "absent").length;
  const excused = participants.filter(p => p.status === "excused").length;
  const reserved = participants.filter(p => p.status === "reserved").length;

  doc.setFontSize(8);
  doc.text(
    `Total: ${totalP}  |  Prezenti: ${present}  |  Intarziati: ${late}  |  Absenti: ${absent}  |  Motivati: ${excused}  |  Asteptati: ${reserved}`,
    105, 36, { align: "center" }
  );

  // Table
  const rows = participants.map((p, i) => [
    String(i + 1),
    stripDiacritics(p.name),
    p.identifier || "-",
    statusLabels[p.status] || p.status,
    p.isPublic ? "Vizitator" : "Elev",
    p.checkinTimestamp ? new Date(p.checkinTimestamp).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : "-",
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["Nr.", "Nume", "Identificator", "Status", "Tip", "Check-in"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 65, 122], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 55 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 22, halign: "center" },
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`prezenta-${safeTitle.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
