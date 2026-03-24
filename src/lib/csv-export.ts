import { downloadFileMobileSafe } from "./download";

export async function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(cell => {
        const escaped = String(cell ?? "").replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(",")
    ),
  ].join("\n");

  const textContent = "\uFEFF" + csvContent;
  const bytes = new TextEncoder().encode(textContent);
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  const b64 = btoa(binString);

  await downloadFileMobileSafe(`${filename}.csv`, b64, "text/csv;charset=utf-8");
}
