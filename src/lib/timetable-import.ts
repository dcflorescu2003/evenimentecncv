// Import combinat al orarelor (elevi, profesori, cancelarie, săli) din XML.
// Parser bazat pe regex, ca să funcționeze și în browser, și în scripturi.
import { applySubjectAlias } from "@/lib/schedule-aliases";

export const DAY_CODES: Record<string, number> = { Lu: 1, Ma: 2, Mi: 3, Jo: 4, Vi: 5 };
const DAY_NAMES: Record<string, number> = { luni: 1, marti: 2, miercuri: 3, joi: 4, vineri: 5 };

export const ROOM_CODE_MAP: Record<string, string> = {
  AEL: "AEL", Inf: "Info", info1: "Info1", info2: "Info2",
  Lfiz: "Lab. fizică", Lch: "Lab. chimie", Lbio: "Lab. bio", sport: "Sala de sport",
  A: "Amfiteatru", B: "Biblioteca", Lb: "Cabinet Lb", Cph: "Cabinet Psih", E: "ECDL", M: "Mansarda",
};

export function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Cod sală din fișier → nume sală din aplicație (sau null dacă necunoscut). */
export function roomCodeToName(code: string, roomNames: string[]): string | null {
  const byNorm = new Map(roomNames.map((n) => [norm(n), n]));
  const c = code.trim();
  if (/^\d+$/.test(c)) return byNorm.get(norm(`Sala ${c}`)) ?? null;
  const mapped = ROOM_CODE_MAP[c];
  if (mapped) return byNorm.get(norm(mapped)) ?? null;
  return byNorm.get(norm(c)) ?? byNorm.get(norm(`Sala ${c}`)) ?? null;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

export interface XmlBlock { label: string; rows: { head: string; cells: string[] }[] }

/** Împarte XML-ul în blocuri <P>titlu</P><Table>…</Table>. */
export function parseBlocks(xml: string): XmlBlock[] {
  const out: XmlBlock[] = [];
  const re = /<P>([^<]*)<\/P>\s*<Table>([\s\S]*?)<\/Table>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const rows: XmlBlock["rows"] = [];
    const trRe = /<TR>([\s\S]*?)<\/TR>/g;
    let tr: RegExpExecArray | null;
    while ((tr = trRe.exec(m[2]))) {
      const head = decode((/<TH>([^<]*)<\/TH>/.exec(tr[1]) ?? [, ""])[1] ?? "");
      const cells: string[] = [];
      const tdRe = /<TD\s*\/>|<TD>([\s\S]*?)<\/TD>/g;
      let td: RegExpExecArray | null;
      while ((td = tdRe.exec(tr[1]))) cells.push(decode(td[1] ?? ""));
      if (cells.length) rows.push({ head, cells });
    }
    out.push({ label: decode(m[1]), rows });
  }
  return out;
}

const ROMAN: Record<string, number> = { V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
/** "Clasa XI A" → "11A" */
export function classLabelToCode(label: string): string | null {
  const m = /Clasa\s+([IVX]+)\s+([A-Z])\b/.exec(label);
  if (!m || !ROMAN[m[1]]) return null;
  return `${ROMAN[m[1]]}${m[2]}`;
}

export interface Segment { subject: string; roomCode: string | null; teacherCode: string | null }

/** "Mate 5 RC" → materie, sală, inițiale. Grupe separate prin " / ". */
export function parseStudentCell(raw: string): Segment[] {
  return raw.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean).map((seg) => {
    const t = seg.split(/\s+/);
    if (t.length === 1) return { subject: t[0], roomCode: null, teacherCode: null };
    if (t.length === 2) return { subject: t[0], roomCode: null, teacherCode: t[1] };
    return { subject: t.slice(0, -2).join(" "), roomCode: t[t.length - 2], teacherCode: t[t.length - 1] };
  });
}

/** Profesori/Cancelarie: "L.rom 12 12A" → materie, sală, clasă. */
export function parseTeacherCell(raw: string): { subject: string; roomCode: string; classCode: string }[] {
  return raw.split(/\s+\/\s+/).map((seg) => seg.trim().split(/\s+/)).filter((t) => t.length >= 3)
    .map((t) => ({ subject: t.slice(0, -2).join(" "), roomCode: t[t.length - 2], classCode: t[t.length - 1] }));
}

/** Săli: "Info 11G PC" → materie, clasă, inițiale. */
export function parseRoomCell(raw: string): { subject: string; classCode: string; teacherCode: string }[] {
  return raw.split(/\s+\/\s+/).map((seg) => seg.trim().split(/\s+/)).filter((t) => t.length >= 3)
    .map((t) => ({ subject: t.slice(0, -2).join(" "), classCode: t[t.length - 2], teacherCode: t[t.length - 1] }));
}

export interface TeacherProfile { id: string; first_name: string; last_name: string; initials: string | null }

/** Potrivește "CIMPOIERU IULIANA SIMONA" cu un profil (nume + primul prenume). */
/** Nume din fișierele de orar scrise diferit față de cont. */
export const TEACHER_NAME_ALIASES: Record<string, string> = { voiculescu: "voicescu" };

export function matchTeacherName(fileName: string, profiles: TeacherProfile[]): TeacherProfile | null {
  fileName = norm(fileName).split(" ").map((t) => TEACHER_NAME_ALIASES[t] ?? t).join(" ");
  const tokens = new Set(norm(fileName.replace(/^Profesor\s+/i, "")).split(" "));
  const hits = profiles.filter((p) => {
    const last = norm(p.last_name).split(" ").filter(Boolean);
    const first = norm(p.first_name).split(" ").filter(Boolean);
    return last.length > 0 && last.every((x) => tokens.has(x)) && first.length > 0 && [...tokens].some((t) => t.length >= 4 && (t.startsWith(first[0]) || first[0].startsWith(t)) || t === first[0]);
  });
  if (hits.length === 1) return hits[0];
  // fallback: doar numele de familie, dacă e unic
  const byLast = profiles.filter((p) => { const l = norm(p.last_name).split(" "); return l.every((x) => tokens.has(x)); });
  return byLast.length === 1 ? byLast[0] : null;
}

export interface ImportedEntry {
  day_of_week: number; period: number; subject: string; teacher_name: string; room: string; teacher_ids: string[];
}
export interface ImportResult {
  classes: { code: string; label: string; entries: ImportedEntry[] }[];
  unknownRooms: string[];
  unmatchedTeachers: string[];
  unresolvedInitials: string[];
  roomConflicts: string[];
  warnings: string[];
  initialsUpdates: { id: string; initials: string }[];
}

const SEP = " / ";

export function buildTimetable(input: {
  studentsXml: string; teachersXml?: string; staffroomXml?: string; roomsXml?: string;
  profiles: TeacherProfile[]; roomNames: string[];
}): ImportResult {
  const { profiles, roomNames } = input;
  const unknownRooms = new Set<string>();
  const unmatchedTeachers = new Set<string>();
  const unresolvedInitials = new Set<string>();
  const roomConflicts: string[] = [];
  const warnings: string[] = [];
  const profById = new Map(profiles.map((p) => [p.id, p]));
  const fullName = (p: TeacherProfile) => `${p.last_name} ${p.first_name}`.trim();
  const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());

  // slot (zi|oră|clasă|sală) → profesor, din fișierul profesori + cancelarie
  type Who = { id: string | null; name: string };
  const slotTeacher = new Map<string, Who[]>();
  const addSlot = (k: string, w: Who) => {
    const arr = slotTeacher.get(k) ?? [];
    if (!arr.some((x) => x.name === w.name)) arr.push(w);
    slotTeacher.set(k, arr);
  };
  const nameToWho = new Map<string, Who>();
  const whoFor = (fileName: string): Who => {
    const cached = nameToWho.get(fileName);
    if (cached) return cached;
    const p = matchTeacherName(fileName, profiles);
    if (!p && !/^LIBER\b/i.test(fileName)) unmatchedTeachers.add(titleCase(fileName));
    const w = { id: p?.id ?? null, name: p ? fullName(p) : titleCase(fileName) };
    nameToWho.set(fileName, w);
    return w;
  };
  if (input.teachersXml) {
    for (const b of parseBlocks(input.teachersXml)) {
      const tName = b.label.replace(/^Profesor\s+/i, "");
      if (/^LIBER\b/i.test(tName)) continue;
      const who = whoFor(tName);
      for (const r of b.rows) {
        const day = DAY_CODES[r.head];
        if (!day) continue;
        r.cells.forEach((c, i) => { for (const s of parseTeacherCell(c)) addSlot(`${day}|${i + 1}|${s.classCode}|${s.roomCode}`, who); });
      }
    }
  }
  if (input.staffroomXml) {
    for (const b of parseBlocks(input.staffroomXml)) {
      const day = DAY_NAMES[norm(b.label.split("-").pop() ?? "")];
      if (!day) continue;
      for (const r of b.rows) {
        if (!r.head || /zi \/ ora/i.test(r.head) || /^LIBER\b/i.test(r.head)) continue;
        const who = whoFor(r.head);
        r.cells.forEach((c, i) => { for (const s of parseTeacherCell(c)) addSlot(`${day}|${i + 1}|${s.classCode}|${s.roomCode}`, who); });
      }
    }
  }
  // săli: verificare
  const roomSlots = new Set<string>();
  if (input.roomsXml) {
    for (const b of parseBlocks(input.roomsXml)) {
      const code = b.label.replace(/^Sala\s+/i, "");
      for (const r of b.rows) {
        const day = DAY_CODES[r.head];
        if (!day) continue;
        r.cells.forEach((c, i) => { for (const s of parseRoomCell(c)) roomSlots.add(`${day}|${i + 1}|${s.classCode}|${code.toLowerCase()}`); });
      }
    }
  }

  // inițiale → profesor, învățate din corelații
  const learned = new Map<string, Map<string, number>>();
  const classes: ImportResult["classes"] = [];
  const blocks = parseBlocks(input.studentsXml);
  const pending: { cls: string; day: number; period: number; segs: Segment[] }[] = [];
  for (const b of blocks) {
    const code = classLabelToCode(b.label);
    if (!code) continue;
    for (const r of b.rows) {
      const day = DAY_CODES[r.head];
      if (!day) continue;
      r.cells.forEach((c, i) => {
        if (!c) return;
        const segs = parseStudentCell(c);
        pending.push({ cls: code, day, period: i + 1, segs });
        for (const s of segs) {
          const w = slotTeacher.get(`${day}|${i + 1}|${code}|${s.roomCode}`);
          if (w?.length === 1 && w[0].id && s.teacherCode) {
            const m = learned.get(s.teacherCode) ?? new Map<string, number>();
            m.set(w[0].id, (m.get(w[0].id) ?? 0) + 1);
            learned.set(s.teacherCode, m);
          }
        }
      });
    }
    classes.push({ code, label: b.label.replace(/^Clasa\s+/, ""), entries: [] });
  }
  const initialsToId = new Map<string, string>();
  for (const [ini, m] of learned) {
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) initialsToId.set(ini, best[0]);
  }
  const initialsUpdates: ImportResult["initialsUpdates"] = [];
  for (const [ini, id] of initialsToId) {
    if ((profById.get(id)?.initials ?? "") !== ini) initialsUpdates.push({ id, initials: ini });
  }

  const byCode = new Map(classes.map((c) => [c.code, c]));
  for (const p of pending) {
    const subjects: string[] = []; const rooms: string[] = []; const names: string[] = []; const ids: string[] = [];
    for (const s of p.segs) {
      subjects.push(applySubjectAlias(s.subject));
      let roomName = "";
      if (s.roomCode) {
        roomName = roomCodeToName(s.roomCode, roomNames) ?? "";
        if (!roomName) { unknownRooms.add(s.roomCode); roomName = s.roomCode; }
        if (roomSlots.size && !roomSlots.has(`${p.day}|${p.period}|${p.cls}|${s.roomCode.toLowerCase()}`))
          roomConflicts.push(`${p.cls} ${["", "Lu", "Ma", "Mi", "Jo", "Vi"][p.day]} ora ${p.period}: sala ${s.roomCode} nu apare în orarul sălilor`);
      }
      rooms.push(roomName);
      const slot = slotTeacher.get(`${p.day}|${p.period}|${p.cls}|${s.roomCode}`);
      let who: Who | null = slot?.length === 1 ? slot[0] : null;
      if (!who && s.teacherCode) {
        const id = initialsToId.get(s.teacherCode);
        const uniq = profiles.filter((x) => x.initials === s.teacherCode);
        const prof = id ? profById.get(id) : uniq.length === 1 ? uniq[0] : undefined;
        if (prof) who = { id: prof.id, name: fullName(prof) };
      }
      if (!who && s.teacherCode) unresolvedInitials.add(s.teacherCode);
      names.push(who?.name ?? s.teacherCode ?? "");
      if (who?.id && !ids.includes(who.id)) ids.push(who.id);
    }
    const uniqSubj = [...new Set(subjects)];
    byCode.get(p.cls)!.entries.push({
      day_of_week: p.day, period: p.period,
      subject: uniqSubj.length === 1 ? uniqSubj[0] : subjects.join(SEP),
      room: rooms.every((r) => !r) ? "" : rooms.join(SEP),
      teacher_name: names.every((n) => !n) ? "" : names.join(SEP),
      teacher_ids: ids,
    });
  }
  if (!input.teachersXml && !input.staffroomXml) warnings.push("Fără orarul profesorilor, numele se deduc doar din inițiale.");
  return {
    classes, unknownRooms: [...unknownRooms].sort(), unmatchedTeachers: [...unmatchedTeachers].sort(),
    unresolvedInitials: [...unresolvedInitials].sort(), roomConflicts, warnings, initialsUpdates,
  };
}

/** Împarte o intrare multi-grupă în segmente aliniate (materie, sală, profesor). */
export function splitEntry(e: { subject: string; room: string | null; teacher_name: string | null }) {
  const s = e.subject.split(SEP); const r = (e.room ?? "").split(SEP); const t = (e.teacher_name ?? "").split(SEP);
  const n = Math.max(s.length, r.length, t.length);
  return Array.from({ length: n }, (_, i) => ({
    subject: s.length === n ? s[i] : s[0], room: r.length === n ? r[i] : r.join(SEP), teacher: t.length === n ? t[i] : t.join(SEP),
  }));
}
