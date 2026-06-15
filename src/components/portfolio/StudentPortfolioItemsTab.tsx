import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Star, Trash2, Download, FileText, Eye, EyeOff, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import {
  formatBytes, getPortfolioFileUrl, uploadItemFile, deletePortfolioFile, validatePortfolioFile,
} from "@/lib/portfolio";

interface Item {
  id: string;
  title: string;
  description: string | null;
  source: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  pinned: boolean;
  visible_to_student: boolean;
  created_at: string;
}

interface Props {
  studentId: string;
}

export default function StudentPortfolioItemsTab({ studentId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pinned, setPinned] = useState(false);
  const [visible, setVisible] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["portfolio_items", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("id, title, description, source, file_path, file_name, file_size, pinned, visible_to_student, created_at")
        .eq("student_id", studentId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Titlul este obligatoriu");
      if (file) {
        const err = validatePortfolioFile(file);
        if (err) throw new Error(err);
      }
      const { data: inserted, error } = await supabase
        .from("portfolio_items")
        .insert({
          student_id: studentId,
          teacher_id: user!.id,
          title: title.trim(),
          description: description.trim() || null,
          source: "manual",
          pinned,
          visible_to_student: visible,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (file) {
        const uploaded = await uploadItemFile(inserted.id, file);
        const { error: upErr } = await supabase
          .from("portfolio_items")
          .update({
            file_path: uploaded.path,
            file_name: uploaded.name,
            file_size: uploaded.size,
            mime_type: uploaded.type,
          })
          .eq("id", inserted.id);
        if (upErr) throw upErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_items", studentId] });
      setOpen(false);
      setTitle(""); setDescription(""); setPinned(false); setVisible(true); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Element adăugat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (vars: { id: string; field: "pinned" | "visible_to_student"; value: boolean }) => {
      const { error } = await supabase
        .from("portfolio_items")
        .update({ [vars.field]: vars.value })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio_items", studentId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: Item) => {
      if (item.file_path) {
        try { await deletePortfolioFile(item.file_path); } catch { /* ignore */ }
      }
      const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_items", studentId] });
      toast.success("Șters");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(path: string, name: string) {
    try {
      const url = await getPortfolioFileUrl(path);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.target = "_blank"; a.rel = "noopener"; a.click();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adaugă element
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Niciun element în portofoliu încă.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Card key={it.id} className={it.pinned ? "border-primary/50" : ""}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {it.pinned && <Star className="h-4 w-4 fill-primary text-primary shrink-0" />}
                    <div className="font-medium truncate">{it.title}</div>
                  </div>
                  {it.description && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
                      {it.description}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-3">
                    <span>
                      {it.source === "submission" ? "Din trimitere" :
                       it.source === "competition" ? "Concurs" :
                       it.source === "diploma" ? "Diplomă" : "Manual"}
                    </span>
                    <span>
                      {new Date(it.created_at).toLocaleDateString("ro-RO", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                      })}
                    </span>
                    {!it.visible_to_student && <span>Ascuns pentru elev</span>}
                  </div>
                  {it.file_path && it.file_name && (
                    <button
                      type="button"
                      onClick={() => download(it.file_path!, it.file_name!)}
                      className="mt-2 flex items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-muted/50"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">{it.file_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatBytes(it.file_size)}
                      </span>
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 self-start">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={it.pinned ? "Dezfixează" : "Fixează"}
                    onClick={() => toggleMutation.mutate({ id: it.id, field: "pinned", value: !it.pinned })}
                  >
                    {it.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={it.visible_to_student ? "Ascunde de elev" : "Arată elevului"}
                    onClick={() => toggleMutation.mutate({ id: it.id, field: "visible_to_student", value: !it.visible_to_student })}
                  >
                    {it.visible_to_student ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Șterge"
                    onClick={() => {
                      if (confirm("Ștergi acest element?")) deleteMutation.mutate(it);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Element nou de portofoliu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titlu *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Fișier (opțional, max 10MB)</Label>
              <Input
                ref={fileRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="i-pinned" checked={pinned} onCheckedChange={(v) => setPinned(!!v)} />
              <Label htmlFor="i-pinned" className="cursor-pointer font-normal">Fixează în top</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="i-visible" checked={visible} onCheckedChange={(v) => setVisible(!!v)} />
              <Label htmlFor="i-visible" className="cursor-pointer font-normal">Vizibil pentru elev</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button disabled={addMutation.isPending} onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? "Se salvează…" : "Adaugă"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
