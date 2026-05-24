import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import type { EditorEntry } from "@/components/schedule/ScheduleGridEditor";
import { extractClassSchedule } from "@/lib/import-orar-xml";

export interface BulkClassInput {
  id: string;
  display_name: string;
  grade_number: number;
  section: string | null;
  academic_year: string;
}

export interface BulkImportResult {
  classId: string;
  entries: EditorEntry[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: BulkClassInput[];
  onImport: (results: BulkImportResult[]) => Promise<void> | void;
}

const ROMAN: Record<number, string> = {
  5: "V", 6: "VI", 7: "VII", 8: "VIII",
  9: "IX", 10: "X", 11: "XI", 12: "XII",
};

function xmlKey(grade: number, section: string | null): string {
  const r = ROMAN[grade];
  if (!r) return "";
  return `${r} ${section && section.trim() ? section.trim() : "A"}`;
}

interface Preview {
  cls: BulkClassInput;
  xmlLabel: string;
  entries: EditorEntry[];
  status: "ok" | "missing" | "empty";
}

export default function ImportOrarXmlBulkDialog({ open, onOpenChange, classes, onImport }: Props) {
  const [xmlText, setXmlText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [overwrite, setOverwrite] = useState(true);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setXmlText("");
    setFileName("");
    setPreviews([]);
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      setXmlText(text);
      setFileName(file.name);

      const list: Preview[] = classes.map((cls) => {
        const label = xmlKey(cls.grade_number, cls.section);
        if (!label) {
          return { cls, xmlLabel: "—", entries: [], status: "missing" as const };
        }
        try {
          const { entries, matchedLabel } = extractClassSchedule(text, label);
          if (!matchedLabel) return { cls, xmlLabel: label, entries: [], status: "missing" as const };
          if (entries.length === 0) return { cls, xmlLabel: label, entries: [], status: "empty" as const };
          return { cls, xmlLabel: label, entries, status: "ok" as const };
        } catch {
          return { cls, xmlLabel: label, entries: [], status: "missing" as const };
        }
      });
      setPreviews(list);
      const ok = list.filter((p) => p.status === "ok").length;
      toast.success(`Fișier procesat. ${ok}/${list.length} clase găsite în XML.`);
    } catch (e: any) {
      toast.error("Eroare la citirea fișierului: " + (e?.message ?? "necunoscută"));
    }
  };

  const confirm = async () => {
    const importable = previews.filter((p) => p.status === "ok");
    if (importable.length === 0) {
      toast.error("Nu există clase de importat");
      return;
    }
    setImporting(true);
    try {
      await onImport(importable.map((p) => ({ classId: p.cls.id, entries: p.entries })));
      onOpenChange(false);
      reset();
    } finally {
      setImporting(false);
    }
  };

  const okCount = previews.filter((p) => p.status === "ok").length;
  const missingCount = previews.filter((p) => p.status !== "ok").length;
  const totalEntries = previews.reduce((s, p) => s + p.entries.length, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import XML — toate clasele</DialogTitle>
          <DialogDescription>
            Încarcă fișierul XML aSc cu orarul tuturor claselor. Sistemul va găsi automat orarul fiecărei clase și-l va salva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <input
              id="xml-bulk-upload"
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById("xml-bulk-upload")?.click()}
            >
              <FileCode2 className="mr-2 h-4 w-4" />
              {fileName ? `Schimbă fișier (${fileName})` : "Alege fișier XML"}
            </Button>
          </div>

          {previews.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="default">{okCount} de importat</Badge>
                {missingCount > 0 && <Badge variant="outline">{missingCount} fără date</Badge>}
                <span className="text-muted-foreground">{totalEntries} ore în total</span>
              </div>

              <div className="max-h-72 overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      <th className="p-2 text-left text-xs font-medium">Clasă</th>
                      <th className="p-2 text-left text-xs font-medium">Etichetă XML</th>
                      <th className="p-2 text-left text-xs font-medium">Ore</th>
                      <th className="p-2 text-left text-xs font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previews.map((p) => (
                      <tr key={p.cls.id} className="border-t">
                        <td className="p-2 font-medium">{p.cls.display_name}</td>
                        <td className="p-2 text-muted-foreground">Clasa {p.xmlLabel}</td>
                        <td className="p-2">{p.entries.length}</td>
                        <td className="p-2">
                          {p.status === "ok" && <Badge variant="default">Găsită</Badge>}
                          {p.status === "missing" && <Badge variant="outline">Lipsă</Badge>}
                          {p.status === "empty" && <Badge variant="outline">0 ore</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={overwrite} onCheckedChange={(v) => setOverwrite(Boolean(v))} />
                Suprascrie orarele existente (recomandat)
              </label>
              {!overwrite && (
                <p className="text-xs text-muted-foreground">
                  Cu această opțiune dezactivată, clasele care au deja un orar nu vor fi modificate. (Notă: implementarea actuală suprascrie întotdeauna — debifează doar pentru a anula importul.)
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>
            Renunță
          </Button>
          <Button onClick={confirm} disabled={importing || okCount === 0 || !overwrite}>
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Se importă..." : `Importă ${okCount} clase`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
