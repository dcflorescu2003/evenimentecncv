// Mapare abrevieri materii din exportul aSc Orare la denumiri complete.
// Sortat după lungime descrescătoare pentru a prinde mai întâi "Info AEL" înainte de "Info".
export const SUBJECT_ALIASES: Record<string, string> = {
  "Info AEL": "Informatică AEL",
  "Ef sport": "Educație fizică",
  "St.s-u": "Studii sociale",
  "L.rom": "Limba română",
  "Et/TI": "Etică / TIC",
  Mate: "Matematică",
  Dirig: "Dirigenție",
  Info: "Informatică",
  Bio: "Biologie",
  Ist: "Istorie",
  Geo: "Geografie",
  Rel: "Religie",
  Le: "Limba engleză",
  Lf: "Limba franceză",
  Em: "Educație muzicală",
  Ep: "Educație plastică",
};

export function applySubjectAlias(s: string): string {
  return SUBJECT_ALIASES[s] ?? s;
}
