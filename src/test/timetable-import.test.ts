import { describe, it, expect } from "vitest";
import { buildTimetable, parseStudentCell, roomCodeToName, splitEntry } from "@/lib/timetable-import";

const rooms = ["Sala 1", "Amfiteatru", "Biblioteca", "Cabinet Lb", "Info", "Cabinet Psih", "Sala de sport"];

describe("timetable import", () => {
  it("maps the room codes the school uses", () => {
    expect(roomCodeToName("A", rooms)).toBe("Amfiteatru");
    expect(roomCodeToName("B", rooms)).toBe("Biblioteca");
    expect(roomCodeToName("Lb", rooms)).toBe("Cabinet Lb");
    expect(roomCodeToName("Inf", rooms)).toBe("Info");
    expect(roomCodeToName("Cph", rooms)).toBe("Cabinet Psih");
    expect(roomCodeToName("1", rooms)).toBe("Sala 1");
    expect(roomCodeToName("M", rooms)).toBeNull();
  });

  it("parses group lessons into aligned parts", () => {
    expect(parseStudentCell("Lf 1 TS / Lf Lb CIS")).toEqual([
      { subject: "Lf", roomCode: "1", teacherCode: "TS" },
      { subject: "Lf", roomCode: "Lb", teacherCode: "CIS" },
    ]);
    expect(splitEntry({ subject: "Limba franceză", room: "Sala 1 / Cabinet Lb", teacher_name: "Tatu Simona / Cimpoieru Iuliana" })[1])
      .toEqual({ subject: "Limba franceză", room: "Cabinet Lb", teacher: "Cimpoieru Iuliana" });
  });

  it("uses the teacher timetable to resolve duplicate initials", () => {
    const students = `<Orar><P>Clasa VI A</P><Table><TR><TH>Lu</TH><TD>Info Inf DC</TD></TR></Table></Orar>`;
    const teachers = `<Orar><P>Profesor DENES CLARA</P><Table><TR><TH>Lu</TH><TD>Info Inf 6A</TD></TR></Table></Orar>`;
    const r = buildTimetable({
      studentsXml: students, teachersXml: teachers, roomNames: rooms,
      profiles: [
        { id: "a", first_name: "Clara", last_name: "Denes", initials: "DC" },
        { id: "b", first_name: "Cristina", last_name: "Dijmarescu", initials: "DC" },
      ],
    });
    expect(r.classes[0].code).toBe("6A");
    expect(r.classes[0].entries[0]).toMatchObject({ subject: "Informatică", room: "Info", teacher_name: "Denes Clara", teacher_ids: ["a"] });
  });
});
