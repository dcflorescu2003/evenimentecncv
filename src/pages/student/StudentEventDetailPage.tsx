import { formatDate } from "@/lib/time";
import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, CalendarDays, Clock, MapPin, Users, Ticket, Download, Upload, FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Event = Tables<"events">;

const submissionStatusLabels: Record<string, string> = {
  uploaded: "Încărcat",
  reviewed: "Revizuit",
  accepted: "Acceptat",
  rejected: "Respins",
};
const submissionStatusColors: Record<string, string> = {
  uploaded: "bg-muted text-muted-foreground",
  reviewed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function StudentEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [bookingConfirm, setBookingConfirm] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event_detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Event;
    },
    enabled: !!id,
  });

  const { data: session } = useQuery({
    queryKey: ["session_detail", event?.session_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("program_sessions").select("*").eq("id", event!.session_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!event?.session_id,
  });

  const { data: myReservation } = useQuery({
    queryKey: ["my_reservation", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("event_id", id!)
        .eq("student_id", user!.id)
        .eq("status", "reserved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Check if student is an assistant for this event
  const { data: isAssistant } = useQuery({
    queryKey: ["my_assistant_check", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_student_assistants")
        .select("id")
        .eq("event_id", id!)
        .eq("student_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!id && !!user,
  });

  const { data: formTemplates = [] } = useQuery({
    queryKey: ["form_templates", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_files")
        .select("*")
        .eq("event_id", id!)
        .eq("file_category", "form_template")
        .order("uploaded_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: mySubmissions = [] } = useQuery({
    queryKey: ["my_submissions", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_submissions")
        .select("*")
        .eq("event_id", id!)
        .eq("student_id", user!.id)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: reservationCount = 0 } = useQuery({
    queryKey: ["reservation_count_student", id],
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

  // Book mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      const { data: eligibility, error: eligError } = await supabase.rpc("check_booking_eligibility", {
        _student_id: user!.id,
        _event_id: id!,
      });
      if (eligError) throw new Error(eligError.message);
      const result = eligibility as any;
      if (!result.allowed) throw new Error(result.reason);

      const { data: reservation, error: resError } = await supabase
        .from("reservations")
        .insert({ student_id: user!.id, event_id: id! })
        .select()
        .single();
      if (resError) throw new Error(resError.message);

      const { error: ticketError } = await supabase
        .from("tickets")
        .insert({ reservation_id: reservation.id });
      if (ticketError) throw new Error(ticketError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_reservation", id] });
      queryClient.invalidateQueries({ queryKey: ["reservation_count_student", id] });
      queryClient.invalidateQueries({ queryKey: ["student_progress"] });
      toast.success("Biletul a fost generat cu succes!");
      setBookingConfirm(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setBookingConfirm(false);
    },
  });

  async function downloadTemplate(file: Tables<"event_files">) {
    const { data, error } = await supabase.storage.from("event-files").createSignedUrl(file.storage_path, 60);
    if (error) {
      toast.error("Nu s-a putut genera link-ul");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleSubmissionUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !uploadTitle || !user) {
      toast.error("Completați titlul și selectați un fișier");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fișierul depășește 10MB");
      return;
    }

    setUploading(true);
    try {
      const path = `submissions/${id}/${user.id}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage.from("event-files").upload(path, file);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("form_submissions").insert({
        event_id: id!,
        student_id: user.id,
        uploaded_by: user.id,
        form_title: uploadTitle,
        file_name: file.name,
        file_type: file.type || null,
        storage_path: path,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["my_submissions", id] });
      toast.success("Formular încărcat cu succes");
      setUploadDialogOpen(false);
      setUploadTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Se încarcă…</div>;
  }

  if (!event) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/student/events")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi
        </Button>
        <p className="text-muted-foreground">Evenimentul nu a fost găsit.</p>
      </div>
    );
  }

  const spotsLeft = event.max_capacity - reservationCount;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/student/events")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi la evenimente
      </Button>

      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold">{event.title}</h1>
        {session && <p className="text-sm text-muted-foreground">{session.name}</p>}
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          <CalendarDays className="h-3 w-3" /> {formatDate(event.date)}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" /> {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)} ({event.counted_duration_hours}h)
        </Badge>
        {event.location && (
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" /> {event.location}
          </Badge>
        )}
        <Badge variant="outline" className="gap-1">
          <Users className="h-3 w-3" /> {spotsLeft} locuri libere
        </Badge>
      </div>

      {/* Booking period */}
      {(event.booking_open_at || event.booking_close_at) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-1">Perioada de înscriere</p>
            <p className="text-sm text-muted-foreground">
              {event.booking_open_at && (
                <>De la: {new Date(event.booking_open_at).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</>
              )}
              {event.booking_open_at && event.booking_close_at && " — "}
              {event.booking_close_at && (
                <>Până la: {new Date(event.booking_close_at).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {event.description && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm whitespace-pre-wrap">{event.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Booking button */}
      {isAssistant ? (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="flex items-center gap-3 p-4">
            <Ticket className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">Ești asistent la acest eveniment</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Prezența ta este confirmată automat.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : myReservation ? (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="flex items-center gap-3 p-4">
            <Ticket className="h-5 w-5 text-green-700 dark:text-green-300" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">Ai rezervare activă</p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Cod: {myReservation.reservation_code?.slice(0, 8)}…
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate("/student/tickets")}>
              Vezi bilet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button className="w-full" size="lg" onClick={() => setBookingConfirm(true)} disabled={spotsLeft <= 0}>
          <Ticket className="mr-2 h-5 w-5" />
          {spotsLeft <= 0 ? "Eveniment complet" : "Rezervă loc"}
        </Button>
      )}

      {/* Tabs: Forms */}
      <Tabs defaultValue="templates" className="space-y-3">
        <TabsList className="w-full">
          <TabsTrigger value="templates" className="flex-1">Formulare ({formTemplates.length})</TabsTrigger>
          <TabsTrigger value="submissions" className="flex-1">Completările mele ({mySubmissions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-3">
          {formTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8" />
                <p>Niciun formular disponibil.</p>
              </CardContent>
            </Card>
          ) : (
            formTemplates.map((f) => (
              <Card key={f.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-sm">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.file_name}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadTemplate(f)}>
                    <Download className="mr-1 h-4 w-4" /> Descarcă
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="submissions" className="space-y-3">
          <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Încarcă formular completat
          </Button>
          {mySubmissions.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8" />
                <p>Nu ai încărcat formulare încă.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titlu</TableHead>
                    <TableHead>Fișier</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mySubmissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-sm">{s.form_title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.file_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={submissionStatusColors[s.status]}>
                          {submissionStatusLabels[s.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Booking Confirm Dialog */}
      <AlertDialog open={bookingConfirm} onOpenChange={(o) => !o && setBookingConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmă rezervarea</AlertDialogTitle>
            <AlertDialogDescription>
              Te înscrii la „{event.title}" pe {formatDate(event.date)}, {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)} ({event.counted_duration_hours}h).
              Se va genera un bilet cu cod QR.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => bookMutation.mutate()} disabled={bookMutation.isPending}>
              {bookMutation.isPending ? "Se procesează…" : "Confirmă rezervarea"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Submission Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(o) => { if (!o) { setUploadDialogOpen(false); setUploadTitle(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Încarcă formular completat</DialogTitle>
            <DialogDescription>Selectează fișierul completat (max 10MB).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-title">Titlu formular *</Label>
              <Input id="sub-title" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="ex: Acord parental" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-file">Fișier *</Label>
              <Input id="sub-file" type="file" ref={fileInputRef} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Anulează</Button>
            <Button onClick={handleSubmissionUpload} disabled={uploading}>
              {uploading ? "Se încarcă…" : "Încarcă"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
