import type { EditorEntry } from "@/components/schedule/ScheduleGridEditor";
import { applySubjectAlias } from "@/lib/schedule-aliases";

const DAY_MAP: Record<string, number> = { Lu: 1, Ma: 2, Mi: 3, Jo: 4, Vi: 5 };

interface ParsedCell {
  subject: string;
  room: string | null;
  teacher: string | null;
}

/**
 * Tokenizează o celulă de tip "Mate 5 RC" / "L.rom 5 GL" / "Info AEL DC" / "Ef sport MN".
 * - ultimul token = inițiale profesor
 * - penultimul = sala DOAR dacă este numeric sau cod scurt majuscule (ex. "AEL", "B")
 * - restul = materie
 */
export function parseScheduleCell(raw: string): ParsedCell | null {
  const tokens = raw.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) return { subject: tokens[0], room: null, teacher: null };

  const teacher = tokens[tokens.length - 1];
  const rest = tokens.slice(0, -1);
  let room: string | null = null;
  let subjectTokens = rest;

  if (rest.length >= 2) {
    const last = rest[rest.length - 1];
    const looksLikeRoom = /^[0-9]+$/.test(last) || /^[A-Z][A-Z0-9-]{0,4}$/.test(last);
    if (looksLikeRoom) {
      room = last;
      subjectTokens = rest.slice(0, -1);
    }
  }

  return { subject: subjectTokens.join(" "), room, teacher };
}

/**
 * Listează numele de clasă găsite în XML (în ordine de apariție, fără duplicate)
 * pentru a ajuta utilizatorul să aleagă numele corect.
 */
export function listClassNamesInXml(xmlText: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // Pattern: "Clasa V A", "Clasa VI A", "Clasa IX C" — număr roman + literă secțiune.
  const re = /Clasa\s+([IVX]+)\s+([A-Z])\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xmlText)) !== null) {
    const name = `${m[1]} ${m[2]}`;
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

function isScheduleTable(tbl: Element): boolean {
  const ths = Array.from(tbl.querySelectorAll("TH"));
  return ths.some((th) => th.textContent?.trim() === "Lu");
}

/**
 * Extrage orele pentru o singură clasă din XML-ul aSc.
 * Caută prima apariție a etichetei `Clasa <className>` și asociază următorul
 * <Table> care conține rânduri de zile (Lu/Ma/Mi/Jo/Vi).
 */
export function extractClassSchedule(
  xmlText: string,
  className: string,
): { entries: EditorEntry[]; matchedLabel: string | null } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("XML invalid");
  }

  const needle = `Clasa ${className.trim()}`;
  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);
  let labelFound = false;
  let target: Element | null = null;
  let cur: Element | null = walker.nextNode() as Element | null;

  while (cur) {
    if (!labelFound) {
      const tag = cur.tagName;
      if ((tag === "P" || tag === "TD") && (cur.textContent ?? "").includes(needle)) {
        // Verifică să fie token complet (nu prefix): "V A" nu trebuie să prindă "VI A".
        const re = new RegExp(`Clasa\\s+${needle.slice(6).replace(/\s+/g, "\\s+")}\\b`);
        if (re.test(cur.textContent ?? "")) labelFound = true;
      }
    } else if (cur.tagName === "Table" && isScheduleTable(cur)) {
      target = cur;
      break;
    }
    cur = walker.nextNode() as Element | null;
  }

  if (!target) return { entries: [], matchedLabel: labelFound ? needle : null };

  const entries: EditorEntry[] = [];
  Array.from(target.querySelectorAll("TR")).forEach((tr) => {
    const th = tr.querySelector("TH");
    const dayLabel = th?.textContent?.trim() ?? "";
    if (!(dayLabel in DAY_MAP)) return;
    const day = DAY_MAP[dayLabel];
    const tds = Array.from(tr.querySelectorAll("TD"));
    // tds[0] = ora 1, tds[1] = coloană fantomă (artefact PDF), tds[2..12] = ore 2..12
    tds.forEach((td, idx) => {
      let period: number;
      if (idx === 0) period = 1;
      else if (idx === 1) return; // skip phantom
      else period = idx;
      if (period < 1 || period > 12) return;
      const text = (td.textContent ?? "").trim();
      if (!text) return;
      const parsed = parseScheduleCell(text);
      if (!parsed || !parsed.subject) return;
      entries.push({
        day_of_week: day,
        period,
        subject: applySubjectAlias(parsed.subject),
        teacher_name: parsed.teacher ?? "",
        room: parsed.room ?? "",
      });
    });
  });

  return { entries, matchedLabel: needle };
}
