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
  ArrowLeft, CalendarDays, Clock, MapPin, Users, FileText, Upload, Trash2, Download,
  UserPlus, X, FolderOpen, CheckCircle2, XCircle, AlertCircle,
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
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [removeCoordId, setRemoveCoordId] = useState<string | null>(null);

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
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, first_name, last_name, display_name)")
        .in("role", ["coordinator_teacher", "teacher"]);
      if (error) throw error;
      return (data || []).map((r: any) => r.profiles).filter(Boolean) as Profile[];
    },
  });

  const { data: reservationCount = 0 } = useQuery({
    queryKey: ["reservation_count", id],
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

  // Participants with tickets (for admin override)
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
              <p className="font-medium">{event.date}</p>
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
        <TabsList>
          <TabsTrigger value="info">Informații</TabsTrigger>
          <TabsTrigger value="participants">Participanți ({participants.length})</TabsTrigger>
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
                  <p><span className="text-muted-foreground">Înscriere de la:</span> {new Date(event.booking_open_at).toLocaleString("ro-RO")}</p>
                )}
                {event.booking_close_at && (
                  <p><span className="text-muted-foreground">Înscriere până la:</span> {new Date(event.booking_close_at).toLocaleString("ro-RO")}</p>
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
          <p className="text-sm text-muted-foreground">Lista participanților cu posibilitate de override al statusului prezență.</p>
          {participants.length === 0 ? (
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
                    <TableHead>Elev</TableHead>
                    <TableHead>Status bilet</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead className="w-40">Override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p: any) => {
                    const profile = p.profiles;
                    const ticket = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets;
                    const name = profile?.display_name || `${profile?.first_name} ${profile?.last_name}`;
                    const ticketStatusLabels: Record<string, string> = {
                      reserved: "Rezervat", present: "Prezent", late: "Întârziat",
                      absent: "Absent", excused: "Motivat", cancelled: "Anulat",
                    };
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {ticket ? ticketStatusLabels[ticket.status] || ticket.status : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ticket?.checkin_timestamp ? new Date(ticket.checkin_timestamp).toLocaleString("ro-RO") : "—"}
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
                      </TableRow>
                    );
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
            <Button size="sm" onClick={() => setCoordDialogOpen(true)} disabled={availableTeachers.length === 0}>
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
                        {c.profiles?.display_name || `${c.profiles?.first_name} ${c.profiles?.last_name}`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("ro-RO")}
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
      <Dialog open={coordDialogOpen} onOpenChange={(o) => { if (!o) { setCoordDialogOpen(false); setSelectedTeacherId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuie coordonator</DialogTitle>
            <DialogDescription>Selectați un profesor coordonator disponibil.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger><SelectValue placeholder="Alegeți profesorul" /></SelectTrigger>
              <SelectContent>
                {availableTeachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.display_name || `${t.first_name} ${t.last_name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoordDialogOpen(false)}>Anulează</Button>
            <Button onClick={() => selectedTeacherId && assignCoordMutation.mutate(selectedTeacherId)} disabled={!selectedTeacherId || assignCoordMutation.isPending}>
              {assignCoordMutation.isPending ? "Se atribuie…" : "Atribuie"}
            </Button>
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
                {new Date(f.uploaded_at).toLocaleString("ro-RO")}
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

