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
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, Plus, Trash2, Check, ChevronsUpDown, Save, UserPlus, Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/time";

type Mode = "admin" | "cse" | "student";

interface Props { mode: Mode }

export default function ClubDetailPage({ mode }: Props) {
  const { id: clubId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const qc = useQueryClient();

  const isAdmin = roles.includes("admin");
  const isCse = roles.includes("cse");
  const isHomeroom = roles.includes("homeroom_teacher");
  const isPlainTeacher = roles.includes("teacher") && !isHomeroom;
  const isTeacher = roles.includes("teacher") || isHomeroom;

  const { data: club, isLoading } = useQuery({
    queryKey: ["club", clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("*")
        .eq("id", clubId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: coordinators = [] } = useQuery({
    queryKey: ["club-coords", clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_coordinators")
        .select("id, user_id, created_at")
        .eq("club_id", clubId!);
      if (error) throw error;
      if (!data?.length) return [];
      const ids = data.map((c: any) => c.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .in("id", ids);
      return data.map((c: any) => ({
        ...c,
        profile: profs?.find((p: any) => p.id === c.user_id),
      }));
    },
  });

  const isCoordinator = !!user && coordinators.some((c: any) => c.user_id === user.id);
  const isCreator = !!user && club?.created_by === user.id;
  const canManage = isAdmin || ((isCse || isTeacher) && isCreator) || isCoordinator;
  const canManageCoords = isAdmin || ((isCse || isTeacher) && isCreator);

  // View mode for non-creator, non-coordinator, non-admin teachers
  const viewMode: "full" | "homeroom_filtered" | "general_only" | "student" =
    mode === "student" ? "student"
    : canManage ? "full"
    : isHomeroom ? "homeroom_filtered"
    : (isPlainTeacher || isCse) ? "general_only"
    : "full";

  // For homeroom_filtered: load own students
  const { data: myStudentIds = [] } = useQuery({
    queryKey: ["homeroom-my-students", user?.id],
    enabled: viewMode === "homeroom_filtered" && !!user,
    queryFn: async () => {
      const { data: classes } = await supabase
        .from("classes").select("id").eq("homeroom_teacher_id", user!.id).eq("is_active", true);
      const cids = (classes ?? []).map((c: any) => c.id);
      if (!cids.length) return [] as string[];
      const { data } = await supabase
        .from("student_class_assignments").select("student_id").in("class_id", cids);
      return [...new Set((data ?? []).map((a: any) => a.student_id))] as string[];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["club-enrollments", clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_enrollments")
        .select("id, student_id, status, enrolled_at, withdrawn_at")
        .eq("club_id", clubId!)
        .eq("status", "enrolled");
      if (error) throw error;
      if (!data?.length) return [];
      const ids = data.map((e: any) => e.student_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .in("id", ids);
      return data
        .map((e: any) => ({ ...e, profile: profs?.find((p: any) => p.id === e.student_id) }))
        .sort((a: any, b: any) =>
          (a.profile?.last_name ?? "").localeCompare(b.profile?.last_name ?? "", "ro"),
        );
    },
  });

  const visibleEnrollments = useMemo(() => {
    if (viewMode === "homeroom_filtered") {
      const mine = new Set(myStudentIds);
      return enrollments.filter((e: any) => mine.has(e.student_id));
    }
    return enrollments;
  }, [enrollments, viewMode, myStudentIds]);

  const { data: meetings = [] } = useQuery({
    queryKey: ["club-meetings", clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_meetings")
        .select("id, date, start_time, end_time, location, notes")
        .eq("club_id", clubId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const myEnrollment = useMemo(
    () => enrollments.find((e: any) => e.student_id === user?.id),
    [enrollments, user?.id],
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Se încarcă…</p>;
  if (!club) return <p className="text-sm text-muted-foreground">Clubul nu a fost găsit.</p>;

  const backPath =
    mode === "admin" ? "/admin/clubs" : mode === "cse" ? "/prof/clubs" : "/student/clubs";

  const showCoordsTab = canManage;
  const showMembersTab = canManage;
  const showMeetingsTab = viewMode !== "general_only";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Înapoi
        </Button>
        <h1 className="font-display text-xl font-semibold flex-1 truncate">{club.name}</h1>
        {(club as any).is_cse && <CseBadge short />}
        <Badge variant={club.status === "active" ? "default" : "outline"}>
          {club.status === "active" ? "Activ" : club.status === "draft" ? "Ciornă" : "Arhivat"}
        </Badge>
      </div>

      {mode === "student" && (
        <StudentEnrollmentBar
          clubId={clubId!}
          studentId={user!.id}
          enrolled={!!myEnrollment}
          enrollmentId={myEnrollment?.id}
        />
      )}

      <Tabs defaultValue="general">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          {showCoordsTab && <TabsTrigger value="coords">Coordonatori</TabsTrigger>}
          {showMembersTab && <TabsTrigger value="members">Membri ({enrollments.length})</TabsTrigger>}
          {showMeetingsTab && <TabsTrigger value="meetings">Întâlniri</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-3 pt-3">
          <GeneralTab club={club} canEdit={canManage} onSaved={() => qc.invalidateQueries({ queryKey: ["club", clubId] })} />
        </TabsContent>

        {showCoordsTab && (
          <TabsContent value="coords" className="space-y-3 pt-3">
            <CoordinatorsTab
              clubId={clubId!}
              coordinators={coordinators}
              canManage={canManageCoords}
              userId={user!.id}
              onChange={() => qc.invalidateQueries({ queryKey: ["club-coords", clubId] })}
            />
          </TabsContent>
        )}

        {showMembersTab && (
          <TabsContent value="members" className="space-y-3 pt-3">
            <MembersTab
              clubId={clubId!}
              enrollments={enrollments}
              canManage={canManage}
              onChange={() => qc.invalidateQueries({ queryKey: ["club-enrollments", clubId] })}
            />
          </TabsContent>
        )}

        {showMeetingsTab && (
          <TabsContent value="meetings" className="space-y-3 pt-3">
            <MeetingsTab
              clubId={clubId!}
              meetings={meetings}
              enrollments={visibleEnrollments}
              canManage={canManage}
              readOnlyAttendance={viewMode === "homeroom_filtered"}
              userId={user!.id}
              isStudent={mode === "student"}
              onChange={() => qc.invalidateQueries({ queryKey: ["club-meetings", clubId] })}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ============================================================
function StudentEnrollmentBar({
  clubId, studentId, enrolled, enrollmentId,
}: {
  clubId: string; studentId: string; enrolled: boolean; enrollmentId?: string;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function enroll() {
    setBusy(true);
    const { data: check, error: checkErr } = await supabase.rpc("check_club_enrollment", {
      _student_id: studentId, _club_id: clubId,
    });
    if (checkErr) { setBusy(false); return toast.error(checkErr.message); }
    if (!(check as any)?.allowed) {
      setBusy(false);
      return toast.error((check as any)?.reason ?? "Nu te poți înscrie");
    }
    const { error } = await supabase.from("club_enrollments").insert({
      club_id: clubId, student_id: studentId, status: "enrolled",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Te-ai înscris cu succes");
    qc.invalidateQueries({ queryKey: ["club-enrollments", clubId] });
  }

  async function withdraw() {
    if (!enrollmentId) return;
    setBusy(true);
    const { error } = await supabase
      .from("club_enrollments")
      .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
      .eq("id", enrollmentId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Te-ai retras din club");
    qc.invalidateQueries({ queryKey: ["club-enrollments", clubId] });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">
            {enrolled ? "Ești înscris la acest club" : "Nu ești înscris la acest club"}
          </p>
          <p className="text-xs text-muted-foreground">
            Te poți retrage oricând cât perioada de înscriere e deschisă.
          </p>
        </div>
        {enrolled ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={withdraw}>
            Retrage-mă
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={enroll}>
            Înscrie-mă
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
function GeneralTab({ club, canEdit, onSaved }: { club: any; canEdit: boolean; onSaved: () => void }) {
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? "");
  const [frequency, setFrequency] = useState(club.frequency_label ?? "");
  const [location, setLocation] = useState(club.location ?? "");
  const [maxCap, setMaxCap] = useState<string>(club.max_capacity?.toString() ?? "");
  const [status, setStatus] = useState(club.status);
  const [openAt, setOpenAt] = useState(club.enrollment_open_at?.slice(0, 16) ?? "");
  const [closeAt, setCloseAt] = useState(club.enrollment_close_at?.slice(0, 16) ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("clubs")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        frequency_label: frequency.trim() || null,
        location: location.trim() || null,
        max_capacity: maxCap ? Number(maxCap) : null,
        status,
        enrollment_open_at: openAt ? new Date(openAt).toISOString() : null,
        enrollment_close_at: closeAt ? new Date(closeAt).toISOString() : null,
      })
      .eq("id", club.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvat");
    onSaved();
  }

  const ro = !canEdit;

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Nume</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={ro} />
          </div>
          <div className="space-y-1">
            <Label>Frecvență</Label>
            <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} disabled={ro} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Descriere</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={ro} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Locație</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} disabled={ro} />
          </div>
          <div className="space-y-1">
            <Label>Capacitate maximă</Label>
            <Input type="number" min={1} value={maxCap} onChange={(e) => setMaxCap(e.target.value)} disabled={ro} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus} disabled={ro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Ciornă</SelectItem>
                <SelectItem value="active">Activ</SelectItem>
                <SelectItem value="archived">Arhivat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Înscrieri deschise de la</Label>
            <Input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} disabled={ro} />
          </div>
          <div className="space-y-1">
            <Label>Înscrieri închise la</Label>
            <Input type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} disabled={ro} />
          </div>
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />{saving ? "Se salvează…" : "Salvează"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
function CoordinatorsTab({
  clubId, coordinators, canManage, userId, onChange,
}: {
  clubId: string; coordinators: any[]; canManage: boolean; userId: string; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: candidates = [] } = useQuery({
    queryKey: ["coord-candidates", search],
    enabled: open && search.length >= 2,
    queryFn: async () => {
      const term = `%${search}%`;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .or(`first_name.ilike.${term},last_name.ilike.${term},display_name.ilike.${term}`)
        .limit(20);
      if (!profs?.length) return [];
      const ids = profs.map((p: any) => p.id);
      const { data: ur } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids)
        .in("role", ["teacher", "homeroom_teacher", "coordinator_teacher", "cse", "student"]);
      const allowed = new Set(ur?.map((r: any) => r.user_id) ?? []);
      return profs.filter((p: any) => allowed.has(p.id));
    },
  });

  async function add(uid: string) {
    if (coordinators.some((c: any) => c.user_id === uid)) {
      toast.info("Este deja coordonator");
      return;
    }
    const { error } = await supabase.from("club_coordinators").insert({
      club_id: clubId, user_id: uid, assigned_by: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("Coordonator adăugat");
    setOpen(false); setSearch("");
    onChange();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("club_coordinators").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminat");
    onChange();
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        {canManage && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="h-4 w-4 mr-1" /> Adaugă coordonator
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Caută profesor sau elev…" value={search} onValueChange={setSearch} />
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
        <div className="space-y-2">
          {coordinators.length === 0 && (
            <p className="text-sm text-muted-foreground">Niciun coordonator încă.</p>
          )}
          {coordinators.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded border p-2">
              <span className="text-sm">
                {c.profile ? `${c.profile.last_name} ${c.profile.first_name}` : c.user_id}
              </span>
              {canManage && (
                <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
function MembersTab({
  clubId, enrollments, canManage, onChange,
}: {
  clubId: string; enrollments: any[]; canManage: boolean; onChange: () => void;
}) {
  async function remove(id: string) {
    const { error } = await supabase
      .from("club_enrollments")
      .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Membru retras");
    onChange();
  }

  return (
    <Card>
      <CardContent className="space-y-2 pt-4">
        {enrollments.length === 0 && (
          <p className="text-sm text-muted-foreground">Niciun membru înscris.</p>
        )}
        {enrollments.map((e: any) => (
          <div key={e.id} className="flex items-center justify-between rounded border p-2">
            <span className="text-sm">
              {e.profile ? `${e.profile.last_name} ${e.profile.first_name}` : e.student_id}
            </span>
            {canManage && (
              <Button variant="ghost" size="sm" onClick={() => remove(e.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
function MeetingsTab({
  clubId, meetings, enrollments, canManage, readOnlyAttendance, userId, isStudent, onChange,
}: {
  clubId: string;
  meetings: any[];
  enrollments: any[];
  canManage: boolean;
  readOnlyAttendance?: boolean;
  userId: string;
  isStudent: boolean;
  onChange: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [newDate, setNewDate] = useState(today);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLoc, setNewLoc] = useState("");
  const [creating, setCreating] = useState(false);
  const [openMeeting, setOpenMeeting] = useState<string | null>(null);

  async function createMeeting() {
    if (!newDate || !newStart || !newEnd) return toast.error("Completează data și intervalul");
    setCreating(true);
    const { error } = await supabase.from("club_meetings").insert({
      club_id: clubId,
      date: newDate,
      start_time: newStart,
      end_time: newEnd,
      location: newLoc.trim() || null,
      created_by: userId,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Întâlnire adăugată");
    setNewDate(new Date().toISOString().slice(0, 10)); setNewStart(""); setNewEnd(""); setNewLoc("");
    onChange();
  }

  async function removeMeeting(id: string) {
    if (!confirm("Ștergi această întâlnire?")) return;
    const { error } = await supabase.from("club_meetings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Șters");
    onChange();
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Adaugă întâlnire</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            <Input placeholder="Locație" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} />
            <Button onClick={createMeeting} disabled={creating}>
              <Plus className="h-4 w-4 mr-1" />Adaugă
            </Button>
          </CardContent>
        </Card>
      )}

      {meetings.length === 0 && (
        <p className="text-sm text-muted-foreground">Nicio întâlnire programată.</p>
      )}
      <div className="space-y-2">
        {meetings.map((m: any) => (
          <Card key={m.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">
                    {formatDate(m.date)} · {m.start_time.slice(0, 5)} – {m.end_time.slice(0, 5)}
                  </p>
                  {m.location && (
                    <p className="text-xs text-muted-foreground">{m.location}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {(canManage || readOnlyAttendance) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenMeeting(openMeeting === m.id ? null : m.id)}
                    >
                      {openMeeting === m.id ? "Închide" : "Prezență"}
                    </Button>
                  )}
                  {canManage && (
                    <Button size="sm" variant="ghost" onClick={() => removeMeeting(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              {openMeeting === m.id && canManage && (
                <AttendancePanel
                  meetingId={m.id}
                  enrollments={enrollments}
                  userId={userId}
                />
              )}
              {openMeeting === m.id && !canManage && readOnlyAttendance && (
                <ReadOnlyAttendancePanel meetingId={m.id} enrollments={enrollments} />
              )}
              {isStudent && <StudentOwnAttendance meetingId={m.id} studentId={userId} />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
function AttendancePanel({
  meetingId, enrollments, userId,
}: {
  meetingId: string; enrollments: any[]; userId: string;
}) {
  const qc = useQueryClient();

  const { data: attendance = [] } = useQuery({
    queryKey: ["club-att", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_attendance")
        .select("id, student_id, status, checkin_at")
        .eq("meeting_id", meetingId);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function setStatus(studentId: string, status: "present" | "late" | "absent") {
    const existing = attendance.find((a: any) => a.student_id === studentId);
    if (existing) {
      const { error } = await supabase
        .from("club_attendance")
        .update({
          status,
          checkin_at: status !== "absent" ? new Date().toISOString() : null,
          marked_by: userId,
        })
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("club_attendance").insert({
        meeting_id: meetingId, student_id: studentId, status,
        checkin_at: status !== "absent" ? new Date().toISOString() : null,
        marked_by: userId,
      });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["club-att", meetingId] });
  }

  return (
    <div className="mt-3 space-y-1 border-t pt-3">
      {enrollments.length === 0 && (
        <p className="text-xs text-muted-foreground">Niciun membru înscris.</p>
      )}
      {enrollments.map((e: any) => {
        const a = attendance.find((x: any) => x.student_id === e.student_id);
        const st = a?.status ?? "absent";
        return (
          <div key={e.id} className="flex items-center justify-between rounded border px-2 py-1.5">
            <span className="text-sm">
              {e.profile ? `${e.profile.last_name} ${e.profile.first_name}` : e.student_id}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant={st === "present" ? "default" : "outline"}
                onClick={() => setStatus(e.student_id, "present")}>Prezent</Button>
              <Button size="sm" variant={st === "late" ? "default" : "outline"}
                onClick={() => setStatus(e.student_id, "late")}>Întârziat</Button>
              <Button size="sm" variant={st === "absent" ? "secondary" : "outline"}
                onClick={() => setStatus(e.student_id, "absent")}>Absent</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudentOwnAttendance({ meetingId, studentId }: { meetingId: string; studentId: string }) {
  const { data } = useQuery({
    queryKey: ["my-att", meetingId, studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("club_attendance")
        .select("status")
        .eq("meeting_id", meetingId)
        .eq("student_id", studentId)
        .maybeSingle();
      return data;
    },
  });
  if (!data) return null;
  const label = data.status === "present" ? "Prezent" : data.status === "late" ? "Întârziat" : "Absent";
  return (
    <div className="mt-2 text-xs text-muted-foreground">
      Prezența ta: <Badge variant="outline">{label}</Badge>
    </div>
  );
}

function ReadOnlyAttendancePanel({ meetingId, enrollments }: { meetingId: string; enrollments: any[] }) {
  const { data: attendance = [] } = useQuery({
    queryKey: ["club-att-ro", meetingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("club_attendance")
        .select("student_id, status")
        .eq("meeting_id", meetingId);
      return data ?? [];
    },
  });
  const labelFor = (s?: string) =>
    s === "present" ? "Prezent" : s === "late" ? "Întârziat" : s === "absent" ? "Absent" : "—";
  const variantFor = (s?: string): "default" | "secondary" | "outline" | "destructive" =>
    s === "present" || s === "late" ? "default" : s === "absent" ? "destructive" : "outline";
  if (enrollments.length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground border-t pt-3">Niciun elev din clasa ta nu este înscris la acest club.</p>;
  }
  return (
    <div className="mt-3 space-y-1 border-t pt-3">
      <p className="text-xs text-muted-foreground mb-2">Doar elevii clasei tale (vizualizare).</p>
      {enrollments.map((e: any) => {
        const a = attendance.find((x: any) => x.student_id === e.student_id);
        return (
          <div key={e.id} className="flex items-center justify-between rounded border px-2 py-1.5">
            <span className="text-sm">
              {e.profile ? `${e.profile.last_name} ${e.profile.first_name}` : e.student_id}
            </span>
            <Badge variant={variantFor(a?.status)}>{labelFor(a?.status)}</Badge>
          </div>
        );
      })}
    </div>
  );
}
