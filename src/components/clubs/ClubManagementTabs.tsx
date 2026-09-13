import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus, Trash2, UserPlus, Check, X, Copy, Phone,
} from "lucide-react";
import { toast } from "sonner";
import { useClubQuestions } from "./ClubEnrollDialog";

const NO_DEPT = "__none__";

function fullName(p: any, fallback: string) {
  return p ? `${p.last_name} ${p.first_name}` : fallback;
}

function answerText(value: any): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ======================= Cereri de înscriere =======================
export function ClubRequestsTab({ clubId, canManage }: { clubId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { data: questions = [] } = useClubQuestions(clubId);

  const { data: pending = [] } = useQuery({
    queryKey: ["club-pending", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_enrollments")
        .select("id, student_id, status, enrolled_at")
        .eq("club_id", clubId)
        .eq("status", "pending");
      if (error) throw error;
      if (!data?.length) return [];
      const ids = data.map((e: any) => e.student_id);
      const { data: profs } = await supabase
        .from("profiles").select("id, first_name, last_name").in("id", ids);
      const { data: answers } = await supabase
        .from("club_enrollment_answers")
        .select("enrollment_id, question_id, value")
        .in("enrollment_id", data.map((e: any) => e.id));
      return data.map((e: any) => ({
        ...e,
        profile: profs?.find((p: any) => p.id === e.student_id),
        answers: (answers ?? []).filter((a: any) => a.enrollment_id === e.id),
      })).sort((a: any, b: any) =>
        (a.profile?.last_name ?? "").localeCompare(b.profile?.last_name ?? "", "ro"));
    },
  });

  async function decide(id: string, approve: boolean) {
    const { error } = await supabase
      .from("club_enrollments")
      .update(approve
        ? { status: "enrolled", enrolled_at: new Date().toISOString() }
        : { status: "rejected" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Membru aprobat" : "Cerere respinsă");
    qc.invalidateQueries({ queryKey: ["club-pending", clubId] });
    qc.invalidateQueries({ queryKey: ["club-enrollments", clubId] });
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        {pending.length === 0 && (
          <p className="text-sm text-muted-foreground">Nicio cerere în așteptare.</p>
        )}
        {pending.map((e: any) => (
          <div key={e.id} className="rounded border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{fullName(e.profile, e.student_id)}</span>
              {canManage && (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => decide(e.id, true)}>
                    <Check className="h-4 w-4 mr-1" />Aprobă
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide(e.id, false)}>
                    <X className="h-4 w-4 mr-1" />Respinge
                  </Button>
                </div>
              )}
            </div>
            {questions.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                {questions.map((q: any) => {
                  const a = e.answers.find((x: any) => x.question_id === q.id);
                  return (
                    <p key={q.id} className="text-xs">
                      <span className="text-muted-foreground">{q.text}: </span>
                      {answerText(a?.value)}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ======================= Departamente =======================
export function ClubDepartmentsTab({ clubId, canManage }: { clubId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: departments = [] } = useQuery({
    queryKey: ["club-departments", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_departments").select("*").eq("club_id", clubId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add() {
    if (!name.trim()) return toast.error("Numele departamentului este obligatoriu");
    const { error } = await supabase.from("club_departments").insert({
      club_id: clubId, name: name.trim(), description: description.trim() || null,
    });
    if (error) return toast.error(error.message);
    setName(""); setDescription("");
    toast.success("Departament adăugat");
    qc.invalidateQueries({ queryKey: ["club-departments", clubId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("club_departments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Șters");
    qc.invalidateQueries({ queryKey: ["club-departments", clubId] });
    qc.invalidateQueries({ queryKey: ["club-enrollments", clubId] });
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Departament nou</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Nume</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descriere</Label>
              <Textarea rows={1} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Adaugă</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="space-y-2 pt-4">
          {departments.length === 0 && (
            <p className="text-sm text-muted-foreground">Niciun departament creat.</p>
          )}
          {departments.map((d: any) => (
            <div key={d.id} className="flex items-start justify-between gap-2 rounded border p-2">
              <div>
                <p className="text-sm font-medium">{d.name}</p>
                {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
              </div>
              {canManage && (
                <Button variant="ghost" size="sm" onClick={() => remove(d.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ======================= Elevi asistenți =======================
export function ClubAssistantsTab({
  clubId, canManage, userId,
}: {
  clubId: string; canManage: boolean; userId: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: assistants = [] } = useQuery({
    queryKey: ["club-assistants", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_student_assistants")
        .select("id, student_id")
        .eq("club_id", clubId);
      if (error) throw error;
      if (!data?.length) return [];
      const { data: profs } = await supabase
        .from("profiles").select("id, first_name, last_name")
        .in("id", data.map((a: any) => a.student_id));
      return data.map((a: any) => ({ ...a, profile: profs?.find((p: any) => p.id === a.student_id) }));
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["club-assistant-candidates", search],
    enabled: open && search.length >= 2,
    queryFn: async () => {
      const term = `%${search}%`;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .or(`first_name.ilike.${term},last_name.ilike.${term},display_name.ilike.${term}`)
        .limit(20);
      if (!profs?.length) return [];
      const { data: ur } = await supabase
        .from("user_roles").select("user_id")
        .in("user_id", profs.map((p: any) => p.id))
        .eq("role", "student");
      const allowed = new Set(ur?.map((r: any) => r.user_id) ?? []);
      return profs.filter((p: any) => allowed.has(p.id));
    },
  });

  async function add(sid: string) {
    const { error } = await supabase.from("club_student_assistants").insert({
      club_id: clubId, student_id: sid, assigned_by: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("Elev asistent adăugat");
    setOpen(false); setSearch("");
    qc.invalidateQueries({ queryKey: ["club-assistants", clubId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("club_student_assistants").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminat");
    qc.invalidateQueries({ queryKey: ["club-assistants", clubId] });
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        {canManage && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="h-4 w-4 mr-1" /> Adaugă elev asistent
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Caută elev…" value={search} onValueChange={setSearch} />
                <CommandList>
                  <CommandEmpty>
                    {search.length < 2 ? "Tastează minim 2 litere" : "Niciun rezultat"}
                  </CommandEmpty>
                  <CommandGroup>
                    {candidates.map((p: any) => (
                      <CommandItem key={p.id} onSelect={() => add(p.id)}>
                        {p.last_name} {p.first_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
        {assistants.length === 0 && (
          <p className="text-sm text-muted-foreground">Niciun elev asistent.</p>
        )}
        {assistants.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between rounded border p-2">
            <span className="text-sm">{fullName(a.profile, a.student_id)}</span>
            {canManage && (
              <Button variant="ghost" size="sm" onClick={() => remove(a.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ======================= Membri =======================
export function ClubMembersTab({
  clubId, enrollments, canManage,
}: {
  clubId: string; enrollments: any[]; canManage: boolean;
}) {
  const qc = useQueryClient();
  const [filterDept, setFilterDept] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: questions = [] } = useClubQuestions(clubId);
  const phoneQuestion = questions.find((q: any) => q.is_phone);

  const { data: departments = [] } = useQuery({
    queryKey: ["club-departments", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_departments").select("*").eq("club_id", clubId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: answers = [] } = useQuery({
    queryKey: ["club-member-answers", clubId, phoneQuestion?.id, enrollments.length],
    enabled: !!phoneQuestion && enrollments.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_enrollment_answers")
        .select("enrollment_id, question_id, value")
        .eq("question_id", phoneQuestion!.id)
        .in("enrollment_id", enrollments.map((e) => e.id));
      if (error) throw error;
      return data ?? [];
    },
  });

  const phoneFor = (enrollmentId: string) => {
    const a = answers.find((x: any) => x.enrollment_id === enrollmentId);
    return a?.value ? answerText(a.value) : null;
  };

  const filtered = useMemo(() => {
    if (filterDept === "all") return enrollments;
    if (filterDept === NO_DEPT) return enrollments.filter((e: any) => !e.department_id);
    return enrollments.filter((e: any) => e.department_id === filterDept);
  }, [enrollments, filterDept]);

  const { data: candidates = [] } = useQuery({
    queryKey: ["club-member-candidates", search],
    enabled: addOpen && search.length >= 2,
    queryFn: async () => {
      const term = `%${search}%`;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .or(`first_name.ilike.${term},last_name.ilike.${term},display_name.ilike.${term}`)
        .limit(20);
      if (!profs?.length) return [];
      const { data: ur } = await supabase
        .from("user_roles").select("user_id")
        .in("user_id", profs.map((p: any) => p.id))
        .eq("role", "student");
      const allowed = new Set(ur?.map((r: any) => r.user_id) ?? []);
      return profs.filter((p: any) => allowed.has(p.id));
    },
  });

  async function addMember(sid: string) {
    if (enrollments.some((e: any) => e.student_id === sid)) {
      return toast.info("Este deja membru");
    }
    const { error } = await supabase.from("club_enrollments").insert({
      club_id: clubId, student_id: sid, status: "enrolled",
    });
    if (error) return toast.error(error.message);
    toast.success("Membru adăugat");
    setAddOpen(false); setSearch("");
    qc.invalidateQueries({ queryKey: ["club-enrollments", clubId] });
  }

  async function setDepartment(enrollmentId: string, deptId: string) {
    const { error } = await supabase
      .from("club_enrollments")
      .update({ department_id: deptId === NO_DEPT ? null : deptId })
      .eq("id", enrollmentId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["club-enrollments", clubId] });
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("club_enrollments")
      .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Membru retras");
    qc.invalidateQueries({ queryKey: ["club-enrollments", clubId] });
  }

  function copyPhones() {
    const list = filtered
      .map((e: any) => phoneFor(e.id))
      .filter(Boolean) as string[];
    if (!list.length) return toast.info("Niciun număr de telefon disponibil");
    navigator.clipboard.writeText(list.join("\n"));
    toast.success(`${list.length} numere copiate`);
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline">
                  <UserPlus className="h-4 w-4 mr-1" />Adaugă membru
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Caută elev…" value={search} onValueChange={setSearch} />
                  <CommandList>
                    <CommandEmpty>
                      {search.length < 2 ? "Tastează minim 2 litere" : "Niciun rezultat"}
                    </CommandEmpty>
                    <CommandGroup>
                      {candidates.map((p: any) => (
                        <CommandItem key={p.id} onSelect={() => addMember(p.id)}>
                          {p.last_name} {p.first_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          {departments.length > 0 && (
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate departamentele</SelectItem>
                <SelectItem value={NO_DEPT}>Fără departament</SelectItem>
                {departments.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {phoneQuestion && (
            <Button size="sm" variant="outline" onClick={copyPhones}>
              <Copy className="h-4 w-4 mr-1" />Copiază numerele
            </Button>
          )}
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">Niciun membru înscris.</p>
        )}
        {filtered.map((e: any) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
            <div className="min-w-[160px]">
              <p className="text-sm">{fullName(e.profile, e.student_id)}</p>
              {phoneQuestion && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />{phoneFor(e.id) ?? "—"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {departments.length > 0 && canManage && (
                <Select
                  value={e.department_id ?? NO_DEPT}
                  onValueChange={(v) => setDepartment(e.id, v)}
                >
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DEPT}>Fără departament</SelectItem>
                    {departments.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {departments.length > 0 && !canManage && e.department_id && (
                <Badge variant="outline">
                  {departments.find((d: any) => d.id === e.department_id)?.name}
                </Badge>
              )}
              {canManage && (
                <Button variant="ghost" size="sm" onClick={() => remove(e.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
