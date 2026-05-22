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

interface ExportReportOptions {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  filename: string;
  orientation?: "portrait" | "landscape";
}

export async function exportReportPdf({
  title,
  subtitle,
  headers,
  rows,
  filename,
  orientation = "portrait",
}: ExportReportOptions) {
  await exportReportPdfSections({
    title,
    subtitle,
    filename,
    orientation,
    sections: [{ headers, rows }],
  });
}

interface ReportSection {
  title?: string;
  headers: string[];
  rows: string[][];
}

interface ExportReportSectionsOptions {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  filename: string;
  orientation?: "portrait" | "landscape";
}

export async function exportReportPdfSections({
  title,
  subtitle,
  sections,
  filename,
  orientation = "portrait",
}: ExportReportSectionsOptions) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = orientation === "landscape" ? 297 : 210;
  const center = pageWidth / 2;

  doc.setFontSize(16);
  doc.text(stripDiacritics(title), center, 15, { align: "center" });

  let startY = 22;

  if (subtitle) {
    doc.setFontSize(10);
    doc.text(stripDiacritics(subtitle), center, startY, { align: "center" });
    startY += 6;
  }

  doc.setFontSize(8);
  doc.text(`Generat: ${new Date().toLocaleDateString("ro-RO")}`, center, startY, { align: "center" });
  startY += 6;

  for (const section of sections) {
    if (!section.rows.length) continue;
    if (section.title) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(stripDiacritics(section.title), 14, startY + 4);
      doc.setFont("helvetica", "normal");
      startY += 7;
    }
    const safeHeaders = section.headers.map((h) => stripDiacritics(h));
    const safeRows = section.rows.map((row) => row.map((cell) => stripDiacritics(String(cell ?? ""))));
    autoTable(doc, {
      startY,
      head: [safeHeaders],
      body: safeRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 65, 122], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    startY = (doc as any).lastAutoTable.finalY + 8;
  }

  const pdfOutput = doc.output("datauristring");
  const base64Data = pdfOutput.split(",")[1];
  await downloadFileMobileSafe(`${filename}.pdf`, base64Data, "application/pdf");
}
