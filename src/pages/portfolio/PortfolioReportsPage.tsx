import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  buildClassReport, buildStudentReport, buildTeacherActivityReport, buildAnnualReport,
  exportBuiltReportPdf, exportBuiltReportCsv, BuiltReport,
} from "@/lib/portfolio-report";

interface Cls { id: string; display_name: string; academic_year: string }
interface Stu { id: string; first_name: string; last_name: string }

const ALL = "_all";

export default function PortfolioReportsPage() {
  const { user } = useAuth();

  // Filtre comune
  const { data: myClasses = [] } = useQuery({
    queryKey: ["portfolio_report_classes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_teacher_classes")
        .select("classes(id, display_name, academic_year)")
        .eq("teacher_id", user!.id);
      if (error) throw error;
      return ((data ?? []) as any[])
        .map((r) => r.classes as Cls)
        .filter(Boolean)
        .sort((a, b) => a.display_name.localeCompare(b.display_name, "ro"));
    },
  });

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const c of myClasses) if (c.academic_year) set.add(c.academic_year);
    return Array.from(set).sort().reverse();
  }, [myClasses]);

  const [year, setYear] = useState<string>(ALL);
  const [classId, setClassId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const filteredClasses = useMemo(() => {
    return year === ALL ? myClasses : myClasses.filter((c) => c.academic_year === year);
  }, [myClasses, year]);

  const { data: studentsForClass = [] } = useQuery({
    queryKey: ["portfolio_report_students", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_class_assignments")
        .select("profiles!student_class_assignments_student_id_fkey(id, first_name, last_name)")
        .eq("class_id", classId);
      if (error) throw error;
      return ((data ?? []) as any[])
        .map((r) => r.profiles as Stu)
        .filter(Boolean)
        .sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? "", "ro"));
    },
  });

  async function run(kind: "class" | "student" | "teacher" | "annual", action: "pdf" | "csv") {
    if (!user?.id) return;
    setBusy(true);
    try {
      const yr = year === ALL ? null : year;
      let report: BuiltReport;
      if (kind === "class") {
        if (!classId) throw new Error("Selectează o clasă");
        const cls = myClasses.find((c) => c.id === classId);
        report = await buildClassReport(user.id, classId, cls?.display_name ?? "Clasă", yr ?? cls?.academic_year ?? null);
      } else if (kind === "student") {
        if (!studentId) throw new Error("Selectează un elev");
        report = await buildStudentReport(user.id, studentId, yr);
      } else if (kind === "teacher") {
        report = await buildTeacherActivityReport(user.id, yr);
      } else {
        if (!yr) throw new Error("Selectează un an școlar pentru raportul anual");
        report = await buildAnnualReport(user.id, yr);
      }
      if (action === "pdf") await exportBuiltReportPdf(report);
      else await exportBuiltReportCsv(report);
      toast.success("Raport generat");
    } catch (e: any) {
      toast.error(e.message ?? "Eroare la generarea raportului");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Rapoarte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generează și exportă rapoarte agregate (PDF sau CSV).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtre generale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>An școlar</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Toți anii</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="class">
        <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="class">Per clasă</TabsTrigger>
          <TabsTrigger value="student">Per elev</TabsTrigger>
          <TabsTrigger value="teacher">Activitate profesor</TabsTrigger>
          <TabsTrigger value="annual">Raport anual</TabsTrigger>
        </TabsList>

        <TabsContent value="class" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label>Clasă</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger><SelectValue placeholder="Selectează clasa" /></SelectTrigger>
                  <SelectContent>
                    {filteredClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.display_name} ({c.academic_year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Statistici per elev: teme, implicare, concursuri, diplome, răspunsuri la tablă.
              </p>
              <ExportButtons busy={busy} onClick={(a) => run("class", a)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="student" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label>Clasă</Label>
                <Select value={classId} onValueChange={(v) => { setClassId(v); setStudentId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selectează clasa" /></SelectTrigger>
                  <SelectContent>
                    {filteredClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.display_name} ({c.academic_year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Elev</Label>
                <Select value={studentId} onValueChange={setStudentId} disabled={!classId}>
                  <SelectTrigger><SelectValue placeholder={classId ? "Selectează elevul" : "Selectează întâi clasa"} /></SelectTrigger>
                  <SelectContent>
                    {studentsForClass.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.last_name} {s.first_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Toate elementele din portofoliu grupate pe sursă.
              </p>
              <ExportButtons busy={busy} onClick={(a) => run("student", a)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teacher" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm">
                Sinteza activității tale: teme, implicare, concursuri, jurnal, documente, materiale proprii.
              </p>
              <ExportButtons busy={busy} onClick={(a) => run("teacher", a)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annual" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm">
                Conține sinteza anului și toate intrările din jurnal marcate pentru raport anual.
                {year === ALL && (
                  <span className="block text-amber-700 dark:text-amber-400 mt-1">
                    Alege un an școlar din filtrele generale.
                  </span>
                )}
              </p>
              <ExportButtons busy={busy || year === ALL} onClick={(a) => run("annual", a)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExportButtons({ busy, onClick }: { busy: boolean; onClick: (a: "pdf" | "csv") => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => onClick("pdf")}>
        <FileText className="mr-2 h-4 w-4" /> Export PDF
      </Button>
      <Button variant="outline" disabled={busy} onClick={() => onClick("csv")}>
        <FileDown className="mr-2 h-4 w-4" /> Export CSV
      </Button>
    </div>
  );
}
