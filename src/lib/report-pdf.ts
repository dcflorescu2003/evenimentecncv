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
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = orientation === "landscape" ? 297 : 210;
  const center = pageWidth / 2;

  // Header
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

  // Table
  const safeHeaders = headers.map(h => stripDiacritics(h));
  const safeRows = rows.map(row => row.map(cell => stripDiacritics(String(cell ?? ""))));

  autoTable(doc, {
    startY,
    head: [safeHeaders],
    body: safeRows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 65, 122], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  const pdfOutput = doc.output("datauristring");
  const base64Data = pdfOutput.split(",")[1];
  await downloadFileMobileSafe(`${filename}.pdf`, base64Data, "application/pdf");
}
