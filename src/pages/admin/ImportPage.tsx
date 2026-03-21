import { formatDate, formatDateTime } from "@/lib/time";
import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Download, FileText, AlertTriangle, CheckCircle, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

interface CsvRow {
  role: string;
  first_name: string;
  last_name: string;
  class_name?: string;
  class_grade?: string;
  class_section?: string;
  student_identifier?: string;
  email?: string;
  [key: string]: string | undefined;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  error?: string;
}

const CSV_TEMPLATE = `role,first_name,last_name,class_grade,class_section,student_identifier,email
student,Ion,Popescu,9,A,,
student,Maria,Ionescu,9,B,,
homeroom_teacher,Elena,Dumitrescu,,,,elena@school.ro
coordinator_teacher,Andrei,Georgescu,,,,andrei@school.ro
teacher,Mihai,Stanescu,,,,mihai@school.ro`;

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: CsvRow = { role: "", first_name: "", last_name: "" };
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
}

function validateRows(rows: CsvRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const validRoles = ["student", "homeroom_teacher", "coordinator_teacher", "teacher"];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // 1-indexed + header
    if (!row.role || !validRoles.includes(row.role)) {
      errors.push({ row: rowNum, field: "role", message: `Rol invalid: "${row.role}". Valide: ${validRoles.join(", ")}` });
    }
    if (!row.first_name) errors.push({ row: rowNum, field: "first_name", message: "Prenumele lipsește" });
    if (!row.last_name) errors.push({ row: rowNum, field: "last_name", message: "Numele lipsește" });
    if (row.role === "student") {
      if (!row.class_grade) errors.push({ row: rowNum, field: "class_grade", message: "Clasa (grad) lipsește pentru elev" });
      const romanMap: Record<string, number> = { "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12 };
      const gradeStr = (row.class_grade || "").trim().toUpperCase();
      const grade = romanMap[gradeStr] || parseInt(gradeStr);
      if (grade >= 9 && !row.class_section) {
        errors.push({ row: rowNum, field: "class_section", message: "Secțiunea lipsește pentru clasele IX–XII" });
      }
    }
  });
  return errors;
}

export default function ImportPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "results">("upload");

  const { data: batches = [] } = useQuery({
    queryKey: ["import_batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_batches")
        .select("*")
        .order("imported_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Selectați un fișier CSV");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast.error("Fișierul CSV este gol sau invalid");
        return;
      }
      const validationErrors = validateRows(parsed);
      setRows(parsed);
      setErrors(validationErrors);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-import-csv", {
        body: { rows },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setResults(data.results || []);
      setStep("results");
      queryClient.invalidateQueries({ queryKey: ["import_batches"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(`Import finalizat: ${data.success_count || 0} reușite, ${data.error_count || 0} erori`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_import.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCredentials() {
    const csvContent = "username,password,first_name,last_name,role\n" +
      results
        .filter((r) => !r.error)
        .map((r) => `${r.username},${r.password},${r.first_name},${r.last_name},${r.role}`)
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credentiale_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printCredentials() {
    const successful = results.filter((r) => !r.error);
    if (successful.length === 0) {
      toast.error("Nu există credențiale de printat");
      return;
    }
    const roleLabels: Record<string, string> = {
      student: "Elev", homeroom_teacher: "Diriginte", coordinator_teacher: "Asistent", teacher: "Profesor", admin: "Admin", manager: "Manager",
    };
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Credențiale</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { font-size: 12px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        .mono { font-family: monospace; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Credențiale conturi — ${formatDate(new Date().toISOString().split("T")[0])}</h1>
      <p>Colegiul Național Cantemir Vodă</p>
      <table>
        <thead><tr><th>#</th><th>Nume</th><th>Utilizator</th><th>Parolă</th><th>Rol</th></tr></thead>
        <tbody>${successful.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td>${r.last_name} ${r.first_name}</td>
          <td class="mono">${r.username}</td>
          <td class="mono">${r.password}</td>
          <td>${roleLabels[r.role] || r.role}</td>
        </tr>`).join("")}</tbody>
      </table></body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.setTimeout(() => w.print(), 300);
    }
  }

  function reset() {
    setStep("upload");
    setRows([]);
    setErrors([]);
    setResults([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  const errorRowNums = new Set(errors.map((e) => e.row));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Import CSV</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Importați elevi, diriginți, asistenți și profesori din fișiere CSV.
        </p>
      </div>

      {step === "upload" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" /> Încărcați fișier CSV
              </CardTitle>
              <CardDescription>
                Selectați un fișier CSV cu datele utilizatorilor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
              />
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" /> Descărcați template CSV
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Format CSV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">Coloane acceptate:</p>
              <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                <li><strong>role</strong> — student / homeroom_teacher / coordinator_teacher / teacher</li>
                <li><strong>first_name</strong> — prenumele</li>
                <li><strong>last_name</strong> — numele de familie</li>
                <li><strong>class_grade</strong> — clasa (5–12), obligatoriu pt elevi</li>
                <li><strong>class_section</strong> — secțiunea (A–G), pt clasele IX–XII</li>
                <li><strong>student_identifier</strong> — identificator opțional</li>
                <li><strong>email</strong> — email opțional</li>
              </ul>
            </CardContent>
          </Card>

          {batches.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Importuri recente</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fișier</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Rânduri</TableHead>
                      <TableHead>Reușite</TableHead>
                      <TableHead>Erori</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{b.file_name}</TableCell>
                        <TableCell>{formatDateTime(b.imported_at)}</TableCell>
                        <TableCell>{b.row_count}</TableCell>
                        <TableCell>{b.success_count}</TableCell>
                        <TableCell>{b.error_count}</TableCell>
                        <TableCell>
                          <Badge variant={b.status === "completed" ? "default" : "destructive"}>
                            {b.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="secondary">{rows.length} rânduri</Badge>
              {errors.length > 0 ? (
                <Badge variant="destructive">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {errors.length} erori
                </Badge>
              ) : (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Validare OK
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Anulează</Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={errors.length > 0 || importMutation.isPending}
              >
                {importMutation.isPending ? "Se importă…" : "Importă"}
              </Button>
            </div>
          </div>

          {errors.length > 0 && (
            <Card className="border-destructive">
              <CardContent className="pt-4">
                <ul className="space-y-1 text-sm">
                  {errors.map((e, i) => (
                    <li key={i} className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-3 w-3 shrink-0" />
                      Rândul {e.row}, câmpul "{e.field}": {e.message}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="rounded-lg border overflow-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Prenume</TableHead>
                  <TableHead>Nume</TableHead>
                  <TableHead>Clasă</TableHead>
                  <TableHead>Secțiune</TableHead>
                  <TableHead>ID elev</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => {
                  const hasError = errorRowNums.has(i + 2);
                  return (
                    <TableRow key={i} className={hasError ? "bg-destructive/10" : ""}>
                      <TableCell>{i + 2}</TableCell>
                      <TableCell>{row.role}</TableCell>
                      <TableCell>{row.first_name}</TableCell>
                      <TableCell>{row.last_name}</TableCell>
                      <TableCell>{row.class_grade}</TableCell>
                      <TableCell>{row.class_section}</TableCell>
                      <TableCell>{row.student_identifier}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {step === "results" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {results.filter((r) => !r.error).length} create
              </Badge>
              {results.filter((r) => r.error).length > 0 && (
                <Badge variant="destructive">
                  {results.filter((r) => r.error).length} erori
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCredentials}>
                <Download className="mr-2 h-4 w-4" /> Exportă CSV
              </Button>
              <Button variant="outline" onClick={printCredentials}>
                <FileText className="mr-2 h-4 w-4" /> Printează PDF
              </Button>
              <Button onClick={reset}>Import nou</Button>
            </div>
          </div>

          <div className="rounded-lg border overflow-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Parolă</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i} className={r.error ? "bg-destructive/10" : ""}>
                    <TableCell>{r.last_name} {r.first_name}</TableCell>
                    <TableCell className="font-mono text-sm">{r.username}</TableCell>
                    <TableCell>
                      {r.error ? "—" : (
                        <div className="flex items-center gap-1">
                          <code className="text-sm">{r.password}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              navigator.clipboard.writeText(r.password);
                              toast.success("Copiat");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{r.role}</TableCell>
                    <TableCell>
                      {r.error ? (
                        <Badge variant="destructive">{r.error}</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Creat
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
