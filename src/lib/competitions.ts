export const DEPARTMENTS = {
  matematica: "Matematică",
  limba_romana: "Limba română",
  engleza: "Engleză",
  franceza: "Franceză",
  informatica: "Informatică",
  geografie: "Geografie",
  istorie: "Istorie",
  fizica: "Fizică",
  chimie: "Chimie",
  religie: "Religie",
  arte: "Arte",
  stiinte_umaniste: "Științe umaniste",
} as const;

export const STAGES = {
  locala: "Locală",
  sector: "Sector",
  municipiu: "Municipiu",
  nationala: "Națională",
  internationala: "Internațională",
} as const;

export const PRIZES = {
  locul_1: "Locul 1",
  locul_2: "Locul 2",
  locul_3: "Locul 3",
  mentiune: "Mențiune",
  aur: "Aur",
  argint: "Argint",
  bronz: "Bronz",
  participare: "Diplomă de participare",
} as const;

export type Department = keyof typeof DEPARTMENTS;
export type Stage = keyof typeof STAGES;
export type Prize = keyof typeof PRIZES;

/** Un rând de premiu per elev selectat: numărul de premii = numărul de elevi. */
export function buildAwardRows(
  input: { competitionId: string; stage: Stage; prize: Prize; academicYear: string; teacherId: string },
  studentIds: string[],
) {
  return Array.from(new Set(studentIds)).map((student_id) => ({
    competition_id: input.competitionId,
    stage: input.stage,
    prize: input.prize,
    academic_year: input.academicYear,
    teacher_id: input.teacherId,
    student_id,
  }));
}

/** Numără premiile grupate după cheia dată. */
export function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) out[key(it)] = (out[key(it)] ?? 0) + 1;
  return out;
}

/** An școlar curent: din septembrie începe anul nou (ex. 2026-2027). */
export function currentAcademicYear(d = new Date()): string {
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
