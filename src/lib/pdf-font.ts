import type jsPDF from "jspdf";

let cache: { regular?: string; bold?: string } = {};
let loading: Promise<void> | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
  const buf = await res.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

async function loadFonts() {
  if (cache.regular && cache.bold) return;
  if (!loading) {
    loading = (async () => {
      const [reg, bold] = await Promise.all([
        fetchAsBase64("/fonts/NotoSans-Regular.ttf"),
        fetchAsBase64("/fonts/NotoSans-Bold.ttf"),
      ]);
      cache = { regular: reg, bold };
    })();
  }
  await loading;
}

/**
 * Register NotoSans as the default font on the jsPDF document.
 * Required for Romanian diacritics (ă, â, î, ș, ț) which helvetica cannot render.
 */
export async function ensureUnicodeFont(doc: jsPDF) {
  await loadFonts();
  doc.addFileToVFS("NotoSans-Regular.ttf", cache.regular!);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", cache.bold!);
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  doc.setFont("NotoSans", "normal");
}

export const PDF_FONT = "NotoSans";
