import { useState, useMemo } from "react";
import { CseBadge } from "@/components/CseBadge";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArrowLeft, Plus, Trash2, Save, Lock, UserPlus, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/time";

type Mode = "admin" | "cse" | "student";

export default function VolunteerProjectDetailPage({ mode }: { mode: Mode }) {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");
  const isCse = roles.includes("cse");
  const isTeacher = roles.includes("teacher") || roles.includes("homeroom_teacher");

  const { data: project, isLoading } = useQuery({
    queryKey: ["volunteer", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("volunteer_projects").select("*").eq("id", projectId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["volunteer-enroll", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from("volunteer_enrollments")
        .select("id, student_id, status, enrolled_at")
        .eq("project_id", projectId!).eq("status", "enrolled");
      if (!data?.length) return [];
      const ids = data.map((e: any) => e.student_id);
      const { data: profs } = await supabase
        .from("profiles").select("id, first_name, last_name").in("id", ids);
      return data.map((e: any) => ({ ...e, profile: profs?.find((p: any) => p.id === e.student_id) }))
        .sort((a: any, b: any) => (a.profile?.last_name ?? "").localeCompare(b.profile?.last_name ?? "", "ro"));
    },
  });

  const { data: days = [] } = useQuery({
    queryKey: ["volunteer-days", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from("volunteer_days")
        .select("id, date, start_time, end_time, location")
        .eq("project_id", projectId!).order("date");
      return data ?? [];
    },
  });

  const isCreator = !!user && project?.created_by === user.id;
  const canManage = isAdmin || ((isCse || isTeacher) && isCreator);
  const myEnrollment = enrollments.find((e: any) => e.student_id === user?.id);

  if (isLoading) return <p className="text-sm text-muted-foreground">Se încarcă…</p>;
  if (!project) return <p className="text-sm text-muted-foreground">Proiect inexistent.</p>;

  const backPath = mode === "admin" ? "/admin/clubs" : mode === "cse" ? "/prof/clubs" : "/student/clubs";

  async function enroll() {
    const { data: check } = await supabase.rpc("check_volunteer_enrollment", {
      _student_id: user!.id, _project_id: projectId!,
    });
    if (!(check as any)?.allowed) return toast.error((check as any)?.reason ?? "Nu te poți înscrie");
    const { error } = await supabase.from("volunteer_enrollments").insert({
      project_id: projectId!, student_id: user!.id, status: "enrolled",
    });
    if (error) return toast.error(error.message);
    toast.success("Înscris");
    qc.invalidateQueries({ queryKey: ["volunteer-enroll", projectId] });
  }
  async function withdraw() {
    if (!myEnrollment) return;
    const { error } = await supabase.from("volunteer_enrollments")
      .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
      .eq("id", myEnrollment.id);
    if (error) return toast.error(error.message);
    toast.success("Retras");
    qc.invalidateQueries({ queryKey: ["volunteer-enroll", projectId] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4 mr-1" />Înapoi
        </Button>
        <h1 className="font-display text-xl font-semibold flex-1 truncate">{project.name}</h1>
        {(project as any).is_cse && <CseBadge short />}
        {(project as any).is_private && (
          <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" />Privat</Badge>
        )}
        <Badge variant={project.status === "active" ? "default" : "outline"}>{project.status}</Badge>
      </div>

      {mode === "student" && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">
                {myEnrollment ? "Ești înscris" : "Nu ești înscris"}
              </p>
              <p className="text-xs text-muted-foreground">
                Perioadă: {formatDate(project.start_date)} – {formatDate(project.end_date)}
              </p>
            </div>
            {myEnrollment
              ? <Button size="sm" variant="outline" onClick={withdraw}>Retrage-mă</Button>
              : <Button size="sm" onClick={enroll}>Înscrie-mă</Button>}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {canManage && <TabsTrigger value="members">Înscriși ({enrollments.length})</TabsTrigger>}
          <TabsTrigger value="days">Zile & prezență</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="pt-3">
          <ProjectGeneralTab project={project} canEdit={canManage}
            onSaved={() => qc.invalidateQueries({ queryKey: ["volunteer", projectId] })} />
        </TabsContent>
        {canManage && (
          <TabsContent value="members" className="pt-3">
            <Card><CardContent className="space-y-2 pt-4">
              {enrollments.length === 0 && <p className="text-sm text-muted-foreground">Niciun înscris.</p>}
              {enrollments.map((e: any) => (
                <div key={e.id} className="rounded border p-2 text-sm">
                  {e.profile ? `${e.profile.last_name} ${e.profile.first_name}` : e.student_id}
                </div>
              ))}
            </CardContent></Card>
          </TabsContent>
        )}
        <TabsContent value="days" className="pt-3">
          <DaysTab projectId={projectId!} days={days} enrollments={enrollments}
            canManage={canManage} userId={user!.id}
            onChange={() => qc.invalidateQueries({ queryKey: ["volunteer-days", projectId] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProjectGeneralTab({ project, canEdit, onSaved }: any) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [startDate, setStartDate] = useState(project.start_date ?? "");
  const [endDate, setEndDate] = useState(project.end_date ?? "");
  const [maxCap, setMaxCap] = useState(project.max_capacity?.toString() ?? "");
  const [status, setStatus] = useState(project.status);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const { error } = await supabase.from("volunteer_projects").update({
      name: name.trim(), description: description.trim() || null,
      start_date: startDate, end_date: endDate,
      max_capacity: maxCap ? Number(maxCap) : null, status,
    }).eq("id", project.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvat"); onSaved();
  }
  const ro = !canEdit;
  return (
    <Card><CardContent className="space-y-3 pt-4">
      <div className="space-y-1"><Label>Nume</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={ro} /></div>
      <div className="space-y-1"><Label>Descriere</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={ro} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Început</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={ro} /></div>
        <div className="space-y-1"><Label>Sfârșit</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={ro} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Capacitate maximă</Label>
          <Input type="number" value={maxCap} onChange={(e) => setMaxCap(e.target.value)} disabled={ro} /></div>
        <div className="space-y-1"><Label>Status</Label>
          <Select value={status} onValueChange={setStatus} disabled={ro}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Ciornă</SelectItem>
              <SelectItem value="active">Activ</SelectItem>
              <SelectItem value="closed">Închis</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {canEdit && <div className="flex justify-end">
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvează</Button></div>}
    </CardContent></Card>
  );
}

function DaysTab({ projectId, days, enrollments, canManage, userId, onChange }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState(today); const [s, setS] = useState(""); const [e, setE] = useState("");
  const [loc, setLoc] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  async function add() {
    if (!d || !s || !e) return toast.error("Completează data și intervalul");
    const { error } = await supabase.from("volunteer_days").insert({
      project_id: projectId, date: d, start_time: s, end_time: e,
      location: loc.trim() || null, created_by: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("Zi adăugată"); setD(new Date().toISOString().slice(0, 10)); setS(""); setE(""); setLoc(""); onChange();
  }
  async function remove(id: string) {
    if (!confirm("Ștergi această zi?")) return;
    const { error } = await supabase.from("volunteer_days").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  }
  return (
    <div className="space-y-3">
      {canManage && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Adaugă zi</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            <Input type="date" value={d} onChange={(ev) => setD(ev.target.value)} />
            <Input type="time" value={s} onChange={(ev) => setS(ev.target.value)} />
            <Input type="time" value={e} onChange={(ev) => setE(ev.target.value)} />
            <Input placeholder="Locație" value={loc} onChange={(ev) => setLoc(ev.target.value)} />
            <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Adaugă</Button>
          </CardContent>
        </Card>
      )}
      {days.length === 0 && <p className="text-sm text-muted-foreground">Nicio zi.</p>}
      {days.map((day: any) => (
        <Card key={day.id}><CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{formatDate(day.date)} · {day.start_time.slice(0,5)} – {day.end_time.slice(0,5)}</p>
              {day.location && <p className="text-xs text-muted-foreground">{day.location}</p>}
            </div>
            <div className="flex items-center gap-1">
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setOpen(open === day.id ? null : day.id)}>
                  {open === day.id ? "Închide" : "Prezență"}
                </Button>
              )}
              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => remove(day.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
          {open === day.id && canManage && (
            <DayAttendancePanel dayId={day.id} enrollments={enrollments} userId={userId} />
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}

function DayAttendancePanel({ dayId, enrollments, userId }: any) {
  const qc = useQueryClient();
  const { data: attendance = [] } = useQuery({
    queryKey: ["v-att", dayId],
    queryFn: async () => {
      const { data } = await supabase.from("volunteer_attendance")
        .select("id, student_id, status").eq("day_id", dayId);
      return data ?? [];
    },
  });
  async function setStatus(studentId: string, status: "present" | "late" | "absent") {
    const existing = attendance.find((a: any) => a.student_id === studentId);
    if (existing) {
      await (supabase.from("volunteer_attendance") as any).update({
        status, checkin_at: status !== "absent" ? new Date().toISOString() : null, marked_by: userId,
      }).eq("id", existing.id);
    } else {
      await (supabase.from("volunteer_attendance") as any).insert({
        day_id: dayId, student_id: studentId, status,
        checkin_at: status !== "absent" ? new Date().toISOString() : null, marked_by: userId,
      });
    }
    qc.invalidateQueries({ queryKey: ["v-att", dayId] });
  }
  return (
    <div className="mt-3 space-y-1 border-t pt-3">
      {enrollments.length === 0 && <p className="text-xs text-muted-foreground">Niciun înscris.</p>}
      {enrollments.map((e: any) => {
        const a = attendance.find((x: any) => x.student_id === e.student_id);
        const st = a?.status ?? "absent";
        return (
          <div key={e.id} className="flex items-center justify-between rounded border px-2 py-1.5">
            <span className="text-sm">{e.profile ? `${e.profile.last_name} ${e.profile.first_name}` : e.student_id}</span>
            <div className="flex gap-1">
              <Button size="sm" variant={st === "present" ? "default" : "outline"} onClick={() => setStatus(e.student_id, "present")}>Prezent</Button>
              <Button size="sm" variant={st === "late" ? "default" : "outline"} onClick={() => setStatus(e.student_id, "late")}>Întârziat</Button>
              <Button size="sm" variant={st === "absent" ? "secondary" : "outline"} onClick={() => setStatus(e.student_id, "absent")}>Absent</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
