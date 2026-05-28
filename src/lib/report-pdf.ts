import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFileMobileSafe } from "./download";
import { ensureUnicodeFont, PDF_FONT } from "./pdf-font";

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
  await ensureUnicodeFont(doc);
  const pageWidth = orientation === "landscape" ? 297 : 210;
  const center = pageWidth / 2;

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(16);
  doc.text(title, center, 15, { align: "center" });

  let startY = 22;

  if (subtitle) {
    doc.setFontSize(10);
    doc.text(subtitle, center, startY, { align: "center" });
    startY += 6;
  }

  doc.setFontSize(8);
  doc.text(`Generat: ${new Date().toLocaleDateString("ro-RO")}`, center, startY, { align: "center" });
  startY += 6;

  for (const section of sections) {
    if (!section.rows.length) continue;
    if (section.title) {
      doc.setFontSize(11);
      doc.setFont(PDF_FONT, "bold");
      doc.text(section.title, 14, startY + 4);
      doc.setFont(PDF_FONT, "normal");
      startY += 7;
    }
    autoTable(doc, {
      startY,
      head: [section.headers],
      body: section.rows.map((row) => row.map((cell) => String(cell ?? ""))),
      styles: { fontSize: 8, cellPadding: 2, font: PDF_FONT },
      headStyles: { fillColor: [41, 65, 122], textColor: 255, fontStyle: "bold", font: PDF_FONT },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    startY = (doc as any).lastAutoTable.finalY + 8;
  }

  const pdfOutput = doc.output("datauristring");
  const base64Data = pdfOutput.split(",")[1];
  await downloadFileMobileSafe(`${filename}.pdf`, base64Data, "application/pdf");
}
