import { formatDate, formatDateTime } from "@/lib/time";
import { exportSimpleAttendancePdf } from "@/lib/attendance-pdf";
import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, CalendarDays, Clock, MapPin, Users, FileText, Upload, Trash2, Download,
  UserPlus, X, FolderOpen, CheckCircle2, XCircle, AlertCircle, FileDown, Search,
} from "lucide-react";
import {
  Select as StatusSelect, SelectContent as StatusSelectContent,
  SelectItem as StatusSelectItem, SelectTrigger as StatusSelectTrigger,
  SelectValue as StatusSelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Event = Tables<"events">;
type EventFile = Tables<"event_files">;
type CoordinatorAssignment = Tables<"coordinator_assignments">;
type Profile = Tables<"profiles">;

const statusLabels: Record<string, string> = {
  draft: "Ciornă", published: "Publicat", closed: "Închis", cancelled: "Anulat",
};
const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
const fileCategoryLabels: Record<string, string> = {
  event_dossier: "Dosar eveniment",
  form_template: "Șablon formular",
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // File upload state
  const [uploadCategory, setUploadCategory] = useState<"event_dossier" | "form_template">("event_dossier");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Coordinator assignment state
  const [coordDialogOpen, setCoordDialogOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [coordSearch, setCoordSearch] = useState("");
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [removeCoordId, setRemoveCoordId] = useState<string | null>(null);
  const [cancelReservation, setCancelReservation] = useState<{ id: string; name: string; isPublic: boolean; publicReservationId?: string } | null>(null);

  // Student assistant state
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false);
  const [assistantSearch, setAssistantSearch] = useState("");
  const [removeAssistantId, setRemoveAssistantId] = useState<string | null>(null);

  // Queries
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Event;
    },
    enabled: !!id,
  });

  const { data: session } = useQuery({
    queryKey: ["session", event?.session_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("program_sessions").select("*").eq("id", event!.session_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!event?.session_id,
  });

  const { data: files = [] } = useQuery({
    queryKey: ["event_files", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_files").select("*").eq("event_id", id!).order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data as EventFile[];
    },
    enabled: !!id,
  });

  const { data: coordinators = [] } = useQuery({
    queryKey: ["coordinator_assignments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordinator_assignments")
        .select("*, profiles:teacher_id(id, first_name, last_name, display_name)")
        .eq("event_id", id!);
      if (error) throw error;
      return data as (CoordinatorAssignment & { profiles: Profile })[];
    },
    enabled: !!id,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["assignable_teachers_admin"],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["coordinator_teacher", "teacher", "homeroom_teacher"]);
      if (roleError) throw roleError;
      const uniqueIds = [...new Set((roleData || []).map((r) => r.user_id))];
      if (uniqueIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .in("id", uniqueIds)
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: reservationCount = 0 } = useQuery({
    queryKey: ["reservation_count", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_events_reserved_counts", {
        _event_ids: [id!],
      });
      if (error) throw error;
      const counts = data as Record<string, number>;
      return counts?.[id!] || 0;
    },
    enabled: !!id,
  });

  // Student participants with tickets
  const { data: participants = [] } = useQuery({
    queryKey: ["admin_event_participants", id],
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

   // Public ticket participants
  const { data: publicParticipants = [] } = useQuery({
    queryKey: ["admin_event_public_participants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_reservations")
        .select("*, public_tickets(*)")
        .eq("event_id", id!)
        .eq("status", "reserved");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  // Event student assistants
  const { data: assistants = [] } = useQuery({
    queryKey: ["event_student_assistants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_student_assistants")
        .select("*")
        .eq("event_id", id!);
      if (error) throw error;
      const sIds = (data || []).map((a: any) => a.student_id);
      if (sIds.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .in("id", sIds);
      if (pErr) throw pErr;
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return (data || []).map((a: any) => ({ ...a, profile: profileMap.get(a.student_id) }));
    },
    enabled: !!id,
  });

  // Fetch class assignments for all student participants + assistants
  const studentIds = participants.map((p: any) => p.profiles?.id).filter(Boolean);
  const assistantStudentIds = assistants.map((a: any) => a.student_id).filter(Boolean);
  const allEventStudentIds = [...new Set([...studentIds, ...assistantStudentIds])];

  const { data: classAssignments = [] } = useQuery({
    queryKey: ["student_class_assignments_for_event", id, allEventStudentIds],
    queryFn: async () => {
      if (allEventStudentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("student_class_assignments")
        .select("student_id, classes(display_name, grade_number, section)")
        .in("student_id", allEventStudentIds);
      if (error) throw error;
      return data as any[];
    },
    enabled: allEventStudentIds.length > 0,
  });

  // Build class lookup map: student_id -> class info
  const classMap = new Map<string, string>();
  const classInfoMap = new Map<string, { gradeNumber: number; section: string }>();
  classAssignments.forEach((a: any) => {
    const cls = a.classes;
    const displayName = cls?.display_name || "";
    if (displayName && !classMap.has(a.student_id)) {
      classMap.set(a.student_id, displayName);
      classInfoMap.set(a.student_id, {
        gradeNumber: cls?.grade_number || 0,
        section: cls?.section || "",
      });
    }
  });

  // Searchable students for assistant assignment dialog
  const { data: allStudents = [] } = useQuery({
    queryKey: ["all_students_for_assistant"],
    queryFn: async () => {
      // Fetch all student role user_ids (handle >1000 rows)
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
      // Batch profile fetches in chunks of 200
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
      // Fetch class assignments for all students
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

  // Exclude already-assistants (allow all students, even if already participants)
  const assistantStudentIdsSet = new Set(assistants.map((a: any) => a.student_id));
  const availableStudents = allStudents.filter(
    (s) => !assistantStudentIdsSet.has(s.id)
  );

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
      queryClient.invalidateQueries({ queryKey: ["event_student_assistants", id] });
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
      queryClient.invalidateQueries({ queryKey: ["event_student_assistants", id] });
      toast.success("Elev asistent eliminat");
      setRemoveAssistantId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDownloadAttendancePdf() {
    if (!event) return;
    const assistantStudentIdSet = new Set(assistants.map((a: any) => a.student_id));

    const simplifiedStatusMap = (status: string): "Prezent" | "Absent" => {
      if (status === "present" || status === "late") return "Prezent";
      return "Absent";
    };

    const rows: { className: string; fullName: string; status: "Prezent" | "Absent" | "*asistent" }[] = [];

    participants.forEach((p: any) => {
      const profile = p.profiles;
      const studentId = profile?.id;
      // If student is also an assistant, skip here — will be added as *asistent
      if (assistantStudentIdSet.has(studentId)) return;
      const ticket = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets;
      const ticketStatus = ticket?.status || "absent";
      rows.push({
        className: classMap.get(studentId) || "-",
        fullName: `${profile?.last_name || ""} ${profile?.first_name || ""}`.trim(),
        status: simplifiedStatusMap(ticketStatus),
      });
    });

    // Add assistants as "*asistent"
    assistants.forEach((a: any) => {
      const profile = a.profile;
      if (profile) {
        rows.push({
          className: classMap.get(a.student_id) || "-",
          fullName: `${profile.last_name || ""} ${profile.first_name || ""}`.trim(),
          status: "*asistent" as const,
        });
      }
    });

    // Sort by class name, then by full name
    rows.sort((a, b) => a.className.localeCompare(b.className, "ro") || a.fullName.localeCompare(b.fullName, "ro"));

    await exportSimpleAttendancePdf(
      event.title,
      formatDate(event.date),
      `${event.start_time?.slice(0, 5)} – ${event.end_time?.slice(0, 5)}`,
      event.location,
      rows,
    );
  }

  // Admin attendance override
  async function adminOverrideStatus(ticketId: string, currentStatus: string, newStatus: string) {
    const { error } = await supabase
      .from("tickets")
      .update({
        status: newStatus as any,
        checkin_timestamp: ["present", "late"].includes(newStatus) ? new Date().toISOString() : null,
      })
      .eq("id", ticketId);
    if (error) { toast.error(error.message); return; }

    await supabase.from("attendance_log").insert({
      ticket_id: ticketId,
      previous_status: currentStatus as any,
      new_status: newStatus as any,
      changed_by: user!.id,
      notes: "Override admin",
    });

    // Also log to audit_logs
    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      action: "attendance_mark",
      entity_type: "ticket",
      entity_id: ticketId,
      details: { previous_status: currentStatus, new_status: newStatus, event_id: id },
    });

    queryClient.invalidateQueries({ queryKey: ["admin_event_participants", id] });
    queryClient.invalidateQueries({ queryKey: ["reservation_count", id] });
    toast.success("Status prezență actualizat");
  }

  async function handleFileUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !uploadTitle || !user) {
      toast.error("Selectați un fișier și completați titlul");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fișierul depășește limita de 10MB");
      return;
    }

    setUploading(true);
    try {
      const path = `${id}/${uploadCategory}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage.from("event-files").upload(path, file);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("event_files").insert({
        event_id: id!,
        title: uploadTitle,
        file_name: file.name,
        file_type: file.type || null,
        file_category: uploadCategory,
        uploaded_by: user.id,
        storage_path: path,
        is_required: false,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["event_files", id] });
      toast.success("Fișier încărcat cu succes");
      setUploadDialogOpen(false);
      setUploadTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  // File delete
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (file) {
        await supabase.storage.from("event-files").remove([file.storage_path]);
      }
      const { error } = await supabase.from("event_files").delete().eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_files", id] });
      toast.success("Fișier șters");
      setDeleteFileId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // File download
  async function downloadFile(file: EventFile) {
    const { data, error } = await supabase.storage.from("event-files").createSignedUrl(file.storage_path, 60);
    if (error) {
      toast.error("Nu s-a putut genera link-ul de descărcare");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  // Coordinator assignment
  const assignCoordMutation = useMutation({
    mutationFn: async (teacherId: string) => {
      const { error } = await supabase.from("coordinator_assignments").insert({
        event_id: id!,
        teacher_id: teacherId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coordinator_assignments", id] });
      toast.success("Coordonator atribuit");
      setCoordDialogOpen(false);
      setSelectedTeacherId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCoordMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("coordinator_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coordinator_assignments", id] });
      toast.success("Coordonator eliminat");
      setRemoveCoordId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignedTeacherIds = coordinators.map((c) => c.teacher_id);
  const availableTeachers = teachers.filter((t) => !assignedTeacherIds.includes(t.id));

  if (eventLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Se încarcă…</div>;
  }

  if (!event) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin/events")}><ArrowLeft className="mr-2 h-4 w-4" /> Înapoi</Button>
        <p className="text-muted-foreground">Evenimentul nu a fost găsit.</p>
      </div>
    );
  }

  const dossierFiles = files.filter((f) => f.file_category === "event_dossier");
  const templateFiles = files.filter((f) => f.file_category === "form_template");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/events")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold">{event.title}</h1>
              <Badge variant="secondary" className={statusColors[event.status]}>
                {statusLabels[event.status]}
              </Badge>
            </div>
            {session && (
              <p className="mt-1 text-sm text-muted-foreground">
                Sesiune: {session.name} ({session.academic_year})
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Data</p>
              <p className="font-medium">{formatDate(event.date)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Interval</p>
              <p className="font-medium">{event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)} ({event.counted_duration_hours}h)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Locație</p>
              <p className="font-medium">{event.location || "Nespecificată"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Înscrieri</p>
              <p className="font-medium">{reservationCount} / {event.max_capacity}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="w-full flex-wrap h-auto justify-start">
          <TabsTrigger value="info">Informații</TabsTrigger>
          <TabsTrigger value="participants">Participanți ({participants.length + assistants.length + publicParticipants.reduce((sum: number, pr: any) => sum + (pr.public_tickets?.filter((t: any) => t.status !== 'cancelled')?.length || 0), 0)})</TabsTrigger>
          <TabsTrigger value="dossier">Dosar ({dossierFiles.length})</TabsTrigger>
          <TabsTrigger value="forms">Formulare ({templateFiles.length})</TabsTrigger>
          <TabsTrigger value="coordinators">Coordonatori ({coordinators.length})</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Descriere</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{event.description || "Fără descriere."}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Detalii</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {event.room_details && <p><span className="text-muted-foreground">Sală:</span> {event.room_details}</p>}
                <p>
                  <span className="text-muted-foreground">Clase eligibile:</span>{" "}
                  {event.eligible_grades && (event.eligible_grades as number[]).length > 0
                    ? (event.eligible_grades as number[]).map((g) => `${g}`).join(", ")
                    : "Toate"}
                </p>
                {event.booking_open_at && (
                  <p><span className="text-muted-foreground">Înscriere de la:</span> {formatDateTime(event.booking_open_at)}</p>
                )}
                {event.booking_close_at && (
                  <p><span className="text-muted-foreground">Înscriere până la:</span> {formatDateTime(event.booking_close_at)}</p>
                )}
              </CardContent>
            </Card>
            {event.notes_for_teachers && (
              <Card className="sm:col-span-2">
                <CardHeader><CardTitle className="text-base">Note pentru profesori</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.notes_for_teachers}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Participants Tab - Admin Override */}
        <TabsContent value="participants" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Lista participanților cu posibilitate de override al statusului prezență.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setAssistantDialogOpen(true); setAssistantSearch(""); }}>
                <UserPlus className="mr-2 h-4 w-4" />
                Adaugă elev asistent
              </Button>
              {(participants.length > 0 || assistants.length > 0) && (
                <Button variant="outline" size="sm" onClick={handleDownloadAttendancePdf}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Descarcă PDF prezență
                </Button>
              )}
            </div>
          </div>
          {participants.length === 0 && publicParticipants.length === 0 && assistants.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8" />
                <p>Niciun participant înscris.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                     <TableHead>Tip</TableHead>
                     <TableHead>Status bilet</TableHead>
                     <TableHead>Check-in</TableHead>
                     <TableHead className="w-40">Override</TableHead>
                     <TableHead className="w-16">Șterge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Student assistants - sorted by class then name */}
                  {[...assistants].sort((a: any, b: any) => {
                    const aInfo = classInfoMap.get(a.student_id);
                    const bInfo = classInfoMap.get(b.student_id);
                    const aGrade = aInfo?.gradeNumber || 999;
                    const bGrade = bInfo?.gradeNumber || 999;
                    if (aGrade !== bGrade) return aGrade - bGrade;
                    const secCmp = (aInfo?.section || "").localeCompare(bInfo?.section || "", "ro");
                    if (secCmp !== 0) return secCmp;
                    return (a.profile?.last_name || "").localeCompare(b.profile?.last_name || "", "ro") || (a.profile?.first_name || "").localeCompare(b.profile?.first_name || "", "ro");
                  }).map((a: any) => {
                    const profile = a.profile;
                    const name = `${profile?.last_name || ""} ${profile?.first_name || ""}`.trim();
                    const className = classMap.get(a.student_id) || "";
                    return (
                      <TableRow key={`assistant-${a.id}`}>
                        <TableCell className="font-medium">
                          {name}
                          {className && <span className="ml-2 text-xs text-muted-foreground">({className})</span>}
                        </TableCell>
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
                        <TableCell className="text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="text-xs text-muted-foreground">—</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRemoveAssistantId(a.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Regular student participants - sorted by class then name */}
                  {[...participants].sort((a: any, b: any) => {
                    const aInfo = classInfoMap.get(a.profiles?.id);
                    const bInfo = classInfoMap.get(b.profiles?.id);
                    const aGrade = aInfo?.gradeNumber || 999;
                    const bGrade = bInfo?.gradeNumber || 999;
                    if (aGrade !== bGrade) return aGrade - bGrade;
                    const secCmp = (aInfo?.section || "").localeCompare(bInfo?.section || "", "ro");
                    if (secCmp !== 0) return secCmp;
                    return (a.profiles?.last_name || "").localeCompare(b.profiles?.last_name || "", "ro") || (a.profiles?.first_name || "").localeCompare(b.profiles?.first_name || "", "ro");
                  }).map((p: any) => {
                    const profile = p.profiles;
                    const ticket = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets;
                    const name = `${profile?.last_name} ${profile?.first_name}`;
                    const className = classMap.get(profile?.id) || "";
                    const ticketStatusLabels: Record<string, string> = {
                      reserved: "Rezervat", present: "Prezent", late: "Întârziat",
                      absent: "Absent", excused: "Motivat", cancelled: "Anulat",
                    };
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {name}
                          {className && <span className="ml-2 text-xs text-muted-foreground">({className})</span>}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">Elev</Badge></TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {ticket ? ticketStatusLabels[ticket.status] || ticket.status : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ticket?.checkin_timestamp ? formatDateTime(ticket.checkin_timestamp) : "—"}
                        </TableCell>
                        <TableCell>
                          {ticket && (
                            <Select
                              value={ticket.status}
                              onValueChange={(v) => adminOverrideStatus(ticket.id, ticket.status, v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="reserved">Rezervat</SelectItem>
                                <SelectItem value="present">Prezent</SelectItem>
                                <SelectItem value="late">Întârziat</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                                <SelectItem value="excused">Motivat</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCancelReservation({ id: p.id, name, isPublic: false })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {publicParticipants.flatMap((pr: any) => {
                    const tickets = Array.isArray(pr.public_tickets) ? pr.public_tickets : [pr.public_tickets].filter(Boolean);
                    const ticketStatusLabels: Record<string, string> = {
                      reserved: "Rezervat", present: "Prezent", late: "Întârziat",
                      absent: "Absent", excused: "Motivat", cancelled: "Anulat",
                    };
                    return tickets.filter((t: any) => t.status !== "cancelled").map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          {t.attendee_name}
                          <span className="ml-1 text-xs text-muted-foreground">({pr.guest_name})</span>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">Vizitator</Badge></TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {ticketStatusLabels[t.status] || t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.checkin_timestamp ? formatDateTime(t.checkin_timestamp) : "—"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={t.status}
                            onValueChange={async (v) => {
                              const { error } = await supabase
                                .from("public_tickets")
                                .update({
                                  status: v,
                                  checkin_timestamp: ["present", "late"].includes(v) ? new Date().toISOString() : null,
                                })
                                .eq("id", t.id);
                              if (error) { toast.error(error.message); return; }
                              queryClient.invalidateQueries({ queryKey: ["admin_event_public_participants", id] });
                              queryClient.invalidateQueries({ queryKey: ["reservation_count", id] });
                              toast.success("Status vizitator actualizat");
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="reserved">Rezervat</SelectItem>
                              <SelectItem value="present">Prezent</SelectItem>
                              <SelectItem value="late">Întârziat</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCancelReservation({ id: t.id, name: t.attendee_name, isPublic: true, publicReservationId: pr.id })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ));
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Dossier Tab */}
        <TabsContent value="dossier" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Documente ale dosarului evenimentului (vizibile doar pentru admin).</p>
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
            <FileTable files={dossierFiles} onDownload={downloadFile} onDelete={setDeleteFileId} />
          )}
        </TabsContent>

        {/* Forms Tab */}
        <TabsContent value="forms" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Șabloane de formulare (descărcabile de elevi eligibili).</p>
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
            <FileTable files={templateFiles} onDownload={downloadFile} onDelete={setDeleteFileId} />
          )}
        </TabsContent>

        {/* Coordinators Tab */}
        <TabsContent value="coordinators" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Profesori coordonatori atribuiți acestui eveniment.</p>
            <Button size="sm" onClick={() => { setCoordDialogOpen(true); setCoordSearch(""); }} disabled={availableTeachers.length === 0}>
              <UserPlus className="mr-2 h-4 w-4" /> Atribuie coordonator
            </Button>
          </div>
          {coordinators.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users className="mb-2 h-8 w-8" />
                <p>Niciun coordonator atribuit</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nume</TableHead>
                    <TableHead>Atribuit la</TableHead>
                    <TableHead className="w-20">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coordinators.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {`${c.profiles?.last_name || ""} ${c.profiles?.first_name || ""}`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(c.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setRemoveCoordId(c.id)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
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

      {/* Coordinator Assignment Dialog */}
      <Dialog open={coordDialogOpen} onOpenChange={(o) => { if (!o) { setCoordDialogOpen(false); setSelectedTeacherId(""); setCoordSearch(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuie coordonator</DialogTitle>
            <DialogDescription>Caută și selectează un profesor coordonator disponibil.</DialogDescription>
          </DialogHeader>
          <Command className="border rounded-md">
            <CommandInput placeholder="Caută profesor după nume..." value={coordSearch} onValueChange={setCoordSearch} />
            <CommandList>
              <CommandEmpty>Niciun profesor găsit.</CommandEmpty>
              <CommandGroup>
                {availableTeachers
                  .filter((t) => {
                    if (!coordSearch) return true;
                    const name = `${t.last_name} ${t.first_name}`.toLowerCase();
                    return name.includes(coordSearch.toLowerCase());
                  })
                  .slice(0, 20)
                  .map((t) => (
                    <CommandItem
                      key={t.id}
                      value={`${t.last_name} ${t.first_name}`}
                      onSelect={() => {
                        assignCoordMutation.mutate(t.id);
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

      {/* Delete File Confirmation */}
      <AlertDialog open={!!deleteFileId} onOpenChange={(o) => !o && setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergeți fișierul?</AlertDialogTitle>
            <AlertDialogDescription>Fișierul va fi șters permanent din stocare.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFileId && deleteFileMutation.mutate(deleteFileId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Coordinator Confirmation */}
      <AlertDialog open={!!removeCoordId} onOpenChange={(o) => !o && setRemoveCoordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminați coordonatorul?</AlertDialogTitle>
            <AlertDialogDescription>Profesorul nu va mai avea acces la scanare pentru acest eveniment.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeCoordId && removeCoordMutation.mutate(removeCoordId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimină
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Reservation Confirmation */}
      <AlertDialog open={!!cancelReservation} onOpenChange={(o) => !o && setCancelReservation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulează rezervarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Rezervarea pentru <strong>{cancelReservation?.name}</strong> va fi anulată, locul va fi eliberat și se va reflecta în contul participantului.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Renunță</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!cancelReservation) return;
                try {
                  if (cancelReservation.isPublic) {
                    // Cancel public ticket
                    const { error } = await supabase.from("public_tickets").update({ status: "cancelled" }).eq("id", cancelReservation.id);
                    if (error) throw error;
                  } else {
                    // Cancel student reservation + ticket
                    const { error: resErr } = await supabase.from("reservations").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", cancelReservation.id);
                    if (resErr) throw resErr;
                    await supabase.from("tickets").update({ status: "cancelled" as any }).eq("reservation_id", cancelReservation.id);
                  }
                  await supabase.from("audit_logs").insert({
                    user_id: user!.id,
                    action: "reservation_cancelled_by_admin",
                    entity_type: cancelReservation.isPublic ? "public_ticket" : "reservation",
                    entity_id: cancelReservation.id,
                    details: { event_id: id, participant_name: cancelReservation.name },
                  });
                  queryClient.invalidateQueries({ queryKey: ["admin_event_participants", id] });
                  queryClient.invalidateQueries({ queryKey: ["admin_event_public_participants", id] });
                  queryClient.invalidateQueries({ queryKey: ["reservation_count", id] });
                  toast.success("Rezervare anulată");
                } catch (e: any) {
                  toast.error(e.message);
                }
                setCancelReservation(null);
              }}
            >
              Anulează rezervarea
            </AlertDialogAction>
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
    </div>
  );
}

// Sub-component for file tables
function FileTable({
  files,
  onDownload,
  onDelete,
}: {
  files: EventFile[];
  onDownload: (f: EventFile) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Titlu</TableHead>
            <TableHead>Fișier</TableHead>
            <TableHead>Încărcat la</TableHead>
            <TableHead className="w-24">Acțiuni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-medium">{f.title}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{f.file_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(f.uploaded_at)}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onDownload(f)} title="Descarcă">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(f.id)} title="Șterge">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

