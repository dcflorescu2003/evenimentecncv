export type AttendancePdfRow = {
  className: string;
  fullName: string;
  status: "Prezent" | "Absent" | "*Asistent";
};

type RegularAttendanceInput = {
  key: string;
  className?: string | null;
  fullName: string;
  status?: string | null;
};

type AssistantAttendanceInput = {
  key: string;
  className?: string | null;
  fullName: string;
};

const normalizeClassName = (className?: string | null) => className?.trim() || "-";

const normalizeFullName = (fullName: string) => fullName.trim();

export const mapAttendancePdfStatus = (status?: string | null): AttendancePdfRow["status"] => {
  if (status === "present" || status === "late" || status === "Prezent") {
    return "Prezent";
  }

  return "Absent";
};

export function buildAttendancePdfRows({
  regularRows,
  assistantRows = [],
}: {
  regularRows: RegularAttendanceInput[];
  assistantRows?: AssistantAttendanceInput[];
}): AttendancePdfRow[] {
  const rows = new Map<string, AttendancePdfRow>();

  regularRows.forEach(({ key, className, fullName, status }) => {
    const safeName = normalizeFullName(fullName);
    if (!key || !safeName || rows.has(key)) return;

    rows.set(key, {
      className: normalizeClassName(className),
      fullName: safeName,
      status: mapAttendancePdfStatus(status),
    });
  });

  assistantRows.forEach(({ key, className, fullName }) => {
    const safeName = normalizeFullName(fullName);
    if (!key || !safeName) return;

    rows.set(key, {
      className: normalizeClassName(className),
      fullName: safeName,
      status: "*Asistent",
    });
  });

  return Array.from(rows.values());
}