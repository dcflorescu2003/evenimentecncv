export const INVOLVEMENT_TYPES = [
  { value: "voluntariat", label: "Voluntariat" },
  { value: "ajutor", label: "Ajutor la clasă" },
  { value: "proiect", label: "Proiect" },
  { value: "eveniment", label: "Eveniment" },
  { value: "sprijin", label: "Sprijin colegi" },
  { value: "club", label: "Activitate club" },
  { value: "materiale", label: "Materiale realizate" },
] as const;

export type InvolvementType = (typeof INVOLVEMENT_TYPES)[number]["value"];

export function involvementTypeLabel(value: string): string {
  return INVOLVEMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

export const BOARD_PICK_MODES = [
  { value: "random", label: "Aleator" },
  { value: "balanced", label: "Echilibrat (cei mai puțin scoși)" },
  { value: "no_repeat", label: "Fără repetare săptămâna curentă" },
  { value: "no_absent", label: "Fără absenți astăzi" },
  { value: "no_today", label: "Fără cei deja ascultați azi" },
  { value: "manual", label: "Manual" },
] as const;

export type BoardPickMode = (typeof BOARD_PICK_MODES)[number]["value"];

export function boardPickModeLabel(value: string): string {
  return BOARD_PICK_MODES.find((m) => m.value === value)?.label ?? value;
}

export function involvementStatusLabel(status: string): string {
  switch (status) {
    case "pending": return "În așteptare";
    case "approved": return "Aprobat";
    case "rejected": return "Respins";
    default: return status;
  }
}

export function involvementStatusColor(status: string): string {
  switch (status) {
    case "pending": return "text-amber-600";
    case "approved": return "text-emerald-600";
    case "rejected": return "text-destructive";
    default: return "text-muted-foreground";
  }
}
