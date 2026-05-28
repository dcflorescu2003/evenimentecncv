import { useMemo, useState } from "react";
import { CseBadge } from "@/components/CseBadge";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, BarChart3, Pencil, Trash2, Power, PowerOff, Search, MessageSquare, CheckCircle2, FileEdit, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/time";

interface Props {
  mode: "admin" | "cse" | "teacher";
}

const TYPE_LABEL: Record<string, string> = {
  general: "General",
  teacher_feedback: "Feedback profesori",
  teacher_survey: "Pentru profesori",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Activ",
  closed: "Închis",
};

export default function FeedbackListPage({ mode }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const base = mode === "admin" ? "/admin/feedback" : "/prof/feedback";
  const isAdmin = mode === "admin";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: forms = [], isLoading } = useQuery({
    enabled: !!user?.id,
    queryKey: ["feedback-forms", mode, user?.id],
    queryFn: async () => {
      let q = supabase
        .from("feedback_forms")
        .select("id, title, description, type, anonymity, status, opens_at, closes_at, created_at, created_by, is_cse")
        .order("created_at", { ascending: false });
      if (mode !== "admin") q = q.eq("created_by", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Admin: load aggregate data (response counts, last submission, authors)
  const formIds = useMemo(() => forms.map((f: any) => f.id), [forms]);
  const authorIds = useMemo(
    () => Array.from(new Set(forms.map((f: any) => f.created_by).filter(Boolean))),
    [forms],
  );

  const { data: respStats } = useQuery({
    enabled: isAdmin && formIds.length > 0,
    queryKey: ["feedback-form-stats", formIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_responses")
        .select("form_id, submitted_at, subject_teacher_id")
        .in("form_id", formIds);
      if (error) throw error;
      const map = new Map<string, { count: number; last: string | null; teachers: Set<string> }>();
      (data ?? []).forEach((r: any) => {
        const e = map.get(r.form_id) ?? { count: 0, last: null, teachers: new Set<string>() };
        e.count += 1;
        if (!e.last || r.submitted_at > e.last) e.last = r.submitted_at;
        if (r.subject_teacher_id) e.teachers.add(r.subject_teacher_id);
        map.set(r.form_id, e);
      });
      return map;
    },
  });

  const { data: authorMap } = useQuery({
    enabled: isAdmin && authorIds.length > 0,
    queryKey: ["feedback-form-authors", authorIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", authorIds as string[]);
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) =>
        m.set(p.id, `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim() || "—"),
      );
      return m;
    },
  });

  const stats = useMemo(() => {
    const s = { total: forms.length, active: 0, draft: 0, closed: 0 };
    forms.forEach((f: any) => {
      if (f.status === "active") s.active++;
      else if (f.status === "draft") s.draft++;
      else if (f.status === "closed") s.closed++;
    });
    return s;
  }, [forms]);

  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = forms.filter((f: any) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      if (q && !f.title.toLowerCase().includes(q)) return false;
      return true;
    });
    if (isAdmin) {
      return [...arr].sort((a: any, b: any) => {
        const rank = (s: string) => (s === "active" ? 0 : s === "draft" ? 1 : 2);
        const d = rank(a.status) - rank(b.status);
        if (d !== 0) return d;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
    }
    return arr;
  }, [forms, statusFilter, typeFilter, search, isAdmin]);

  const handleStatus = async (id: string, status: "active" | "closed" | "draft") => {
    const { error } = await supabase.from("feedback_forms").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status actualizat");
    qc.invalidateQueries({ queryKey: ["feedback-forms"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sigur ștergi chestionarul și toate răspunsurile?")) return;
    const { error } = await supabase.from("feedback_forms").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Șters");
    qc.invalidateQueries({ queryKey: ["feedback-forms"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Toate chestionarele de pe platformă."
              : "Chestionarele tale și rapoartele lor."}
          </p>
        </div>
        <Button onClick={() => navigate(`${base}/new`)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Chestionar nou
        </Button>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <StatCard label="Total" value={stats.total} icon={MessageSquare} />
          <StatCard label="Active" value={stats.active} icon={CheckCircle2} tone="text-emerald-600" />
          <StatCard label="Draft" value={stats.draft} icon={FileEdit} tone="text-amber-600" />
          <StatCard label="Închise" value={stats.closed} icon={XCircle} tone="text-muted-foreground" />
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută după titlu…"
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate statusurile</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="closed">Închise</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate tipurile</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="teacher_feedback">Feedback profesori</SelectItem>
              <SelectItem value="teacher_survey">Pentru profesori</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : filteredForms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {forms.length === 0 ? "Niciun chestionar creat." : "Niciun chestionar pentru filtrele alese."}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredForms.map((f: any) => {
            const st = respStats?.get(f.id);
            const author = authorMap?.get(f.created_by);
            return (
              <Card key={f.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <CardTitle className="text-base break-words">{f.title}</CardTitle>
                      {(f as any).is_cse && <CseBadge short />}
                    </div>
                    <Badge variant={f.status === "active" ? "default" : "secondary"}>
                      {STATUS_LABEL[f.status]}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {TYPE_LABEL[f.type]} • {f.anonymity === "anonymous" ? "Anonim" : f.anonymity === "identified" ? "Identificat" : "Anonim opțional"}
                    {f.closes_at && <> • până la {formatDate(f.closes_at)}</>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-end gap-2">
                  {f.description && <p className="line-clamp-2 text-sm text-muted-foreground">{f.description}</p>}

                  {isAdmin && (
                    <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-2 text-xs sm:grid-cols-4">
                      <Metric label="Răspunsuri" value={st?.count ?? 0} />
                      <Metric label="Ultim." value={st?.last ? formatDate(st.last) : "—"} />
                      {f.type === "teacher_feedback" ? (
                        <Metric label="Profesori" value={st?.teachers.size ?? 0} />
                      ) : (
                        <Metric label="Creat" value={formatDate(f.created_at)} />
                      )}
                      <Metric label="Autor" value={author ?? "—"} />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => navigate(`${base}/${f.id}/report`)}>
                      <BarChart3 className="h-3 w-3 mr-1" /> Raport
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`${base}/${f.id}/edit`)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editează
                    </Button>
                    {f.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatus(f.id, "active")}>
                        <Power className="h-3 w-3 mr-1" /> Publică
                      </Button>
                    )}
                    {f.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatus(f.id, "closed")}>
                        <PowerOff className="h-3 w-3 mr-1" /> Închide
                      </Button>
                    )}
                    {f.status === "closed" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatus(f.id, "active")}>
                        <Power className="h-3 w-3 mr-1" /> Redeschide
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(f.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, tone,
}: { label: string; value: number; icon: any; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <Icon className={`h-5 w-5 ${tone ?? "text-primary"}`} />
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate font-medium text-foreground">{value}</div>
    </div>
  );
}
