import { formatDate, formatDateTime, isValidTime24h, normalizeTimeInput } from "@/lib/time";
import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, CalendarDays, Clock, MapPin, Users, UserPlus, X, ScanLine,
  Upload, Download, Trash2, FolderOpen, FileText, Pencil,
} from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  draft: "Ciornă", published: "Publicat", closed: "Închis", cancelled: "Anulat",
  reserved: "Rezervat", present: "Prezent", late: "Întârziat",
  absent: "Absent", excused: "Motivat",
};

const fileCategoryLabels: Record<string, string> = {
  event_dossier: "Dosar eveniment",
  form_template: "Șablon formular",
};

type EventStatus = "draft" | "published" | "closed" | "cancelled";

const eventStatusLabels: Record<EventStatus, string> = {
  draft: "Ciornă", published: "Publicat", closed: "Închis", cancelled: "Anulat",
};

interface EventForm {
  session_id: string;
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  room_details: string;
  max_capacity: number;
  status: EventStatus;
  eligible_grades: number[];
  eligible_classes: string[];
  booking_open_date: string;
  booking_open_time: string;
  booking_close_date: string;
  booking_close_time: string;
  notes_for_teachers: string;
  is_public: boolean;
}

const emptyForm: EventForm = {
  session_id: "", title: "", description: "", date: "",
  start_time: "08:00", end_time: "10:00", location: "", room_details: "",
  max_capacity: 30, status: "draft", eligible_grades: [], eligible_classes: [],
  booking_open_date: "", booking_open_time: "",
  booking_close_date: "", booking_close_time: "",
  notes_for_teachers: "", is_public: false,
};

function computeDuration(start: string, end: string) {
  if (!start || !end) return { display: "", hours: 0 };
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const totalMin = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMin <= 0) return { display: "0h", hours: 0 };
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const rounded = m >= 30 ? h + 1 : h;
  return { display: `${h}h${m > 0 ? m + "m" : ""}`, hours: Math.max(rounded, 1) };
}

function splitDatetime(dt: string | null): { date: string; time: string } {
  if (!dt) return { date: "", time: "" };
  const d = new Date(dt);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

function joinDatetime(date: string, time: string): string | null {
  if (!date) return null;
  const t = time || "00:00";
  return `${date}T${t}:00`;
}

export default function ProfEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [coordDialogOpen, setCoordDialogOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [coordSearch, setCoordSearch] = useState("");
  const [removeCoordId, setRemoveCoordId] = useState<string | null>(null);

  // File upload state
  const [uploadCategory, setUploadCategory] = useState<"event_dossier" | "form_template">("event_dossier");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);

  // Student assistant state
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false);
  const [assistantSearch, setAssistantSearch] = useState("");
  const [removeAssistantId, setRemoveAssistantId] = useState<string | null>(null);

  const { data: event, isLoading } = useQuery({
    queryKey: ["prof_event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: coordinators = [] } = useQuery({
    queryKey: ["prof_coordinators", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordinator_assignments")
        .select("*, profiles:teacher_id(id, first_name, last_name, display_name)")
        .eq("event_id", id!);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  const { data: availableTeachers = [] } = useQuery({
    queryKey: ["assignable_teachers"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["teacher", "coordinator_teacher", "homeroom_teacher"]);
      if (rolesError) throw rolesError;
      const userIds = [...new Set((roles || []).map((r) => r.user_id))];
      if (userIds.length === 0) return [];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .in("id", userIds)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });
      if (profilesError) throw profilesError;
      return profiles || [];
    },
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["prof_event_participants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, profiles:student_id(id, first_name, last_name, display_name), tickets(*)")
        .eq("event_id", id!)
        .neq("status", "cancelled");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  const { data: reservationCount = 0 } = useQuery({
    queryKey: ["prof_reservation_count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", id!)
        .eq("status", "reserved");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  const { data: files = [] } = useQuery({
    queryKey: ["prof_event_files", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_files")
        .select("*")
        .eq("event_id", id!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Event student assistants
  const { data: assistants = [] } = useQuery({
    queryKey: ["prof_event_assistants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_student_assistants")
        .select("*")
        .eq("event_id", id!);
      if (error) throw error;
      const studentIds = (data || []).map((a: any) => a.student_id);
      if (studentIds.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .in("id", studentIds);
      if (pErr) throw pErr;
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return (data || []).map((a: any) => ({ ...a, profile: profileMap.get(a.student_id) }));
    },
    enabled: !!id,
  });

  // Searchable students for assistant assignment
  const { data: allStudents = [] } = useQuery({
    queryKey: ["all_students_for_prof_assistant"],
    queryFn: async () => {
      let allRoleIds: string[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "student")
          .range(from, from + batchSize - 1);
        if (roleError) throw roleError;
        if (!roleData || roleData.length === 0) break;
        allRoleIds.push(...roleData.map((r) => r.user_id));
        if (roleData.length < batchSize) break;
        from += batchSize;
      }
      const ids = [...new Set(allRoleIds)];
      if (ids.length === 0) return [];
      const chunkSize = 200;
      let allProfiles: any[] = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, display_name")
          .in("id", chunk)
          .eq("is_active", true);
        if (error) throw error;
        if (data) allProfiles.push(...data);
      }
      // Fetch class assignments
      const classMap: Record<string, string> = {};
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data: scaData } = await supabase
          .from("student_class_assignments")
          .select("student_id, classes(display_name)")
          .in("student_id", chunk);
        if (scaData) {
          for (const sca of scaData) {
            const cls = sca.classes as any;
            if (cls?.display_name) classMap[sca.student_id] = cls.display_name;
          }
        }
      }
      allProfiles = allProfiles.map((p) => ({ ...p, class_name: classMap[p.id] || null }));
      allProfiles.sort((a: any, b: any) => {
        const cmp = (a.last_name || "").localeCompare(b.last_name || "", "ro");
        return cmp !== 0 ? cmp : (a.first_name || "").localeCompare(b.first_name || "", "ro");
      });
      return allProfiles;
    },
    enabled: assistantDialogOpen,
  });

  const assistantStudentIdsSet = new Set(assistants.map((a: any) => a.student_id));
  const availableStudents = allStudents.filter((s: any) => !assistantStudentIdsSet.has(s.id));

  const assignedIds = coordinators.map((c: any) => c.teacher_id);
  const unassigned = availableTeachers.filter((t: any) => !assignedIds.includes(t.id));

  const dossierFiles = files.filter((f) => f.file_category === "event_dossier");
  const templateFiles = files.filter((f) => f.file_category === "form_template");

  const assignMutation = useMutation({
    mutationFn: async (teacherId: string) => {
      const { error } = await supabase.from("coordinator_assignments").insert({
        event_id: id!, teacher_id: teacherId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prof_coordinators", id] });
      toast.success("Coordonator adăugat");
      setCoordDialogOpen(false);
      setSelectedTeacherId("");
      setCoordSearch("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("coordinator_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prof_coordinators", id] });
      toast.success("Coordonator eliminat");
      setRemoveCoordId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignAssistantMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase.from("event_student_assistants").insert({
        event_id: id!,
        student_id: studentId,
        assigned_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prof_event_assistants", id] });
      toast.success("Elev asistent adăugat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAssistantMutation = useMutation({
    mutationFn: async (assistantId: string) => {
      const { error } = await supabase.from("event_student_assistants").delete().eq("id", assistantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prof_event_assistants", id] });
      toast.success("Elev asistent eliminat");
      setRemoveAssistantId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // File upload
  async function handleFileUpload() {
    if (!user || !id) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) { toast.error("Selectați un fișier"); return; }
    if (!uploadTitle.trim()) { toast.error("Introduceți un titlu"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Fișierul depășește 10MB"); return; }

    setUploading(true);
    try {
      const path = `${id}/${uploadCategory}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage.from("event-files").upload(path, file);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("event_files").insert({
        event_id: id,
        title: uploadTitle,
        file_name: file.name,
        file_type: file.type || null,
        file_category: uploadCategory,
        uploaded_by: user.id,
        storage_path: path,
        is_required: false,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["prof_event_files", id] });
      toast.success("Fișier încărcat");
      setUploadDialogOpen(false);
      setUploadTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (file) await supabase.storage.from("event-files").remove([file.storage_path]);
      const { error } = await supabase.from("event_files").delete().eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prof_event_files", id] });
      toast.success("Fișier șters");
      setDeleteFileId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function downloadFile(file: any) {
    const { data, error } = await supabase.storage.from("event-files").createSignedUrl(file.storage_path, 60);
    if (error) { toast.error("Nu s-a putut genera link-ul"); return; }
    window.open(data.signedUrl, "_blank");
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Se încarcă…</div>;
  if (!event) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate("/prof/events")}><ArrowLeft className="mr-2 h-4 w-4" /> Înapoi</Button>
      <p className="text-muted-foreground">Evenimentul nu a fost găsit.</p>
    </div>
  );

  // Sort participants by last name
  const sortedParticipants = [...participants].sort((a: any, b: any) => {
    const aLast = a.profiles?.last_name || "";
    const bLast = b.profiles?.last_name || "";
    return aLast.localeCompare(bLast, "ro") || (a.profiles?.first_name || "").localeCompare(b.profiles?.first_name || "", "ro");
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/prof/events")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold">{event.title}</h1>
            <Badge variant="secondary">{statusLabels[event.status]}</Badge>
          </div>
        </div>
        <Button size="sm" onClick={() => navigate(`/prof/scan/${event.id}`)}>
          <ScanLine className="mr-2 h-4 w-4" /> Scanează
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{formatDate(event.date)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Clock className="h-5 w-5 text-primary" />
          <div><p className="text-xs text-muted-foreground">Interval</p><p className="font-medium">{event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)} ({event.counted_duration_hours}h)</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <MapPin className="h-5 w-5 text-primary" />
          <div><p className="text-xs text-muted-foreground">Locație</p><p className="font-medium">{event.location || "—"}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Users className="h-5 w-5 text-primary" />
          <div><p className="text-xs text-muted-foreground">Înscrieri</p><p className="font-medium">{reservationCount} / {event.max_capacity}</p></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="coordinators" className="space-y-4">
        <TabsList>
          <TabsTrigger value="coordinators">Coordonatori ({coordinators.length})</TabsTrigger>
          <TabsTrigger value="participants">Participanți ({participants.length + assistants.length})</TabsTrigger>
          <TabsTrigger value="dossier">Dosar ({dossierFiles.length})</TabsTrigger>
          <TabsTrigger value="forms">Formulare ({templateFiles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="coordinators" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Profesorii care coordonează acest eveniment.</p>
            <Button size="sm" onClick={() => { setCoordDialogOpen(true); setCoordSearch(""); }}>
              <UserPlus className="mr-2 h-4 w-4" /> Adaugă
            </Button>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profesor</TableHead>
                  <TableHead>Ore contorizate</TableHead>
                  <TableHead className="w-20">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coordinators.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Niciun coordonator.</TableCell></TableRow>
                ) : coordinators.map((c: any) => {
                  const p = c.profiles;
                  const name = p?.display_name || `${p?.last_name} ${p?.first_name}`;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>{event.counted_duration_hours}h</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setRemoveCoordId(c.id)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="participants" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Lista participanților înscriși.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setAssistantDialogOpen(true); setAssistantSearch(""); }}>
                <UserPlus className="mr-2 h-4 w-4" /> Adaugă elev asistent
              </Button>
              <Button size="sm" onClick={() => navigate(`/prof/event/${id}`)}>
                <Users className="mr-2 h-4 w-4" /> Lista completă
              </Button>
            </div>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Elev</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.length === 0 && assistants.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Niciun participant.</TableCell></TableRow>
                ) : (
                  <>
                    {/* Student assistants */}
                    {assistants.map((a: any) => {
                      const profile = a.profile;
                      const name = profile?.display_name || `${profile?.last_name || ""} ${profile?.first_name || ""}`.trim();
                      return (
                        <TableRow key={`assistant-${a.id}`}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px]">
                              Asistent
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Prezent
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRemoveAssistantId(a.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Regular participants sorted by last name */}
                    {sortedParticipants.map((p: any) => {
                      const profile = p.profiles;
                      const ticket = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets;
                      const name = profile?.display_name || `${profile?.last_name} ${profile?.first_name}`;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">Elev</Badge></TableCell>
                          <TableCell>
                            <Badge variant="secondary">{statusLabels[ticket?.status || "reserved"]}</Badge>
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      );
                    })}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Dossier Tab */}
        <TabsContent value="dossier" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Documente birocratice ale evenimentului.</p>
            <Button size="sm" onClick={() => { setUploadCategory("event_dossier"); setUploadDialogOpen(true); }}>
              <Upload className="mr-2 h-4 w-4" /> Încarcă document
            </Button>
          </div>
          {dossierFiles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FolderOpen className="mb-2 h-8 w-8" />
                <p>Niciun document în dosar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titlu</TableHead>
                    <TableHead>Fișier</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-24">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dossierFiles.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{f.file_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(f.uploaded_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => downloadFile(f)}><Download className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteFileId(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Forms Tab */}
        <TabsContent value="forms" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Șabloane de formulare (descărcabile de elevi).</p>
            <Button size="sm" onClick={() => { setUploadCategory("form_template"); setUploadDialogOpen(true); }}>
              <Upload className="mr-2 h-4 w-4" /> Încarcă șablon
            </Button>
          </div>
          {templateFiles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="mb-2 h-8 w-8" />
                <p>Niciun șablon de formular</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titlu</TableHead>
                    <TableHead>Fișier</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-24">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templateFiles.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{f.file_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(f.uploaded_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => downloadFile(f)}><Download className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteFileId(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add coordinator dialog - searchable */}
      <Dialog open={coordDialogOpen} onOpenChange={(o) => { if (!o) { setCoordDialogOpen(false); setSelectedTeacherId(""); setCoordSearch(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adaugă coordonator</DialogTitle>
            <DialogDescription>Caută și selectează un profesor pentru a-l adăuga ca coordonator.</DialogDescription>
          </DialogHeader>
          <Command className="border rounded-md">
            <CommandInput placeholder="Caută profesor după nume..." value={coordSearch} onValueChange={setCoordSearch} />
            <CommandList>
              <CommandEmpty>Niciun profesor găsit.</CommandEmpty>
              <CommandGroup>
                {unassigned
                  .filter((t: any) => {
                    if (!coordSearch) return true;
                    const name = `${t.last_name} ${t.first_name}`.toLowerCase();
                    return name.includes(coordSearch.toLowerCase());
                  })
                  .slice(0, 20)
                  .map((t: any) => (
                    <CommandItem
                      key={t.id}
                      value={`${t.last_name} ${t.first_name}`}
                      onSelect={() => {
                        assignMutation.mutate(t.id);
                        setCoordSearch("");
                      }}
                      className="cursor-pointer"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {t.last_name} {t.first_name}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoordDialogOpen(false)}>Închide</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove coordinator confirmation */}
      <AlertDialog open={!!removeCoordId} onOpenChange={(o) => !o && setRemoveCoordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimină coordonatorul?</AlertDialogTitle>
            <AlertDialogDescription>Coordonatorul nu va mai putea verifica prezența la acest eveniment.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeCoordId && removeMutation.mutate(removeCoordId)}>Elimină</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Student Assistant Dialog */}
      <Dialog open={assistantDialogOpen} onOpenChange={(o) => { if (!o) { setAssistantDialogOpen(false); setAssistantSearch(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adaugă elev asistent</DialogTitle>
            <DialogDescription>Caută și selectează un elev care va fi asistent la acest eveniment.</DialogDescription>
          </DialogHeader>
          <Command className="border rounded-md">
            <CommandInput placeholder="Caută elev după nume..." value={assistantSearch} onValueChange={setAssistantSearch} />
            <CommandList>
              <CommandEmpty>Niciun elev găsit.</CommandEmpty>
              <CommandGroup>
                {availableStudents
                  .filter((s: any) => {
                    if (!assistantSearch) return true;
                    const search = assistantSearch.toLowerCase();
                    const name = `${s.last_name} ${s.first_name}`.toLowerCase();
                    const className = (s.class_name || "").toLowerCase();
                    return name.includes(search) || className.includes(search);
                  })
                  .slice(0, 20)
                  .map((s: any) => (
                    <CommandItem
                      key={s.id}
                      value={`${s.last_name} ${s.first_name} ${s.class_name || ""}`}
                      onSelect={() => {
                        assignAssistantMutation.mutate(s.id);
                      }}
                      className="cursor-pointer"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      <span>{s.last_name} {s.first_name}</span>
                      {s.class_name && (
                        <Badge variant="outline" className="ml-2 text-xs">{s.class_name}</Badge>
                      )}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssistantDialogOpen(false)}>Închide</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Assistant Confirmation */}
      <AlertDialog open={!!removeAssistantId} onOpenChange={(o) => !o && setRemoveAssistantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminați elevul asistent?</AlertDialogTitle>
            <AlertDialogDescription>Elevul nu va mai apărea ca asistent la acest eveniment.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeAssistantId && removeAssistantMutation.mutate(removeAssistantId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimină
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload file dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(o) => { if (!o) { setUploadDialogOpen(false); setUploadTitle(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Încarcă {fileCategoryLabels[uploadCategory]?.toLowerCase()}</DialogTitle>
            <DialogDescription>Selectați un fișier (max 10MB).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-title">Titlu *</Label>
              <Input id="file-title" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="ex: Acord parental" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-input">Fișier *</Label>
              <Input id="file-input" type="file" ref={fileInputRef} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Anulează</Button>
            <Button onClick={handleFileUpload} disabled={uploading}>
              {uploading ? "Se încarcă…" : "Încarcă"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete file confirmation */}
      <AlertDialog open={!!deleteFileId} onOpenChange={(o) => !o && setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Șterge fișierul?</AlertDialogTitle>
            <AlertDialogDescription>Fișierul va fi eliminat permanent.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFileId && deleteFileMutation.mutate(deleteFileId)}>Șterge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
