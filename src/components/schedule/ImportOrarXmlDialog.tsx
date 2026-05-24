import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileCode2 } from "lucide-react";
import {
  extractClassSchedule,
  listClassNamesInXml,
} from "@/lib/import-orar-xml";
import type { EditorEntry } from "@/components/schedule/ScheduleGridEditor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClassName: string;
  onImport: (entries: EditorEntry[]) => void;
}

export default function ImportOrarXmlDialog({
  open,
  onOpenChange,
  defaultClassName,
  onImport,
}: Props) {
  const [xmlText, setXmlText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [classNames, setClassNames] = useState<string[]>([]);
  const [className, setClassName] = useState(defaultClassName);

  useEffect(() => {
    if (open) {
      setClassName(defaultClassName);
      setXmlText(null);
      setFileName("");
      setClassNames([]);
    }
  }, [open, defaultClassName]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setXmlText(text);
    setFileName(file.name);
    const names = listClassNamesInXml(text);
    setClassNames(names);
    if (names.length === 0) {
      toast.warning("Nu am găsit nume de clase în acest XML.");
    }
  };

  const handleImport = () => {
    if (!xmlText) {
      toast.error("Alege întâi un fișier XML.");
      return;
    }
    if (!className.trim()) {
      toast.error('Introdu numele clasei (ex. „V A”).');
      return;
    }
    try {
      const { entries, matchedLabel } = extractClassSchedule(xmlText, className);
      if (!matchedLabel) {
        toast.error(`Eticheta „Clasa ${className}” nu a fost găsită în XML.`);
        return;
      }
      if (entries.length === 0) {
        toast.error("Am găsit eticheta clasei, dar tabelul orar este gol.");
        return;
      }
      onImport(entries);
      toast.success(`${entries.length} ore încărcate. Verifică și apasă „Salvează”.`);
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "necunoscută";
      toast.error("Eroare la parsare: " + msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-primary" />
            Import XML aSc Orare
          </DialogTitle>
          <DialogDescription>
            Încarcă fișierul XML exportat din aSc (PDF salvat ca XML din Adobe Acrobat) și
            alege numele clasei pentru care vrei să imporți orarul.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="xml-file">Fișier XML</Label>
            <Input
              id="xml-file"
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                Încărcat: <span className="font-medium">{fileName}</span> —{" "}
                {classNames.length} clase detectate
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="class-name">Numele clasei în XML</Label>
            <Input
              id="class-name"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="ex. V A, IX C, XII G"
            />
            <p className="text-xs text-muted-foreground">
              Format: număr roman + spațiu + literă secțiune (fără cuvântul „Clasa”).
            </p>
          </div>

          {classNames.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Clase găsite în fișier (click pentru a alege)</Label>
              <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded border bg-muted/30 p-2">
                {classNames.map((n) => (
                  <Badge
                    key={n}
                    variant={n === className ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setClassName(n)}
                  >
                    {n}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button onClick={handleImport}>Importă ore</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
