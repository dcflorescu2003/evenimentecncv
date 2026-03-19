import { formatDate, formatDateTime } from "@/lib/time";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  ArrowLeft, Search, ScanLine, CheckCircle2, Clock, XCircle, ShieldAlert, ChevronDown, ChevronUp, Trash2, FileDown, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { exportAttendancePdf } from "@/lib/attendance-pdf";

const statusLabels: Record<string, string> = {
  reserved: "Rezervat", present: "Prezent", late: "Întârziat",
  absent: "Absent", excused: "Motivat", cancelled: "Anulat",
};
const statusColors: Record<string, string> = {
  reserved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  present: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  late: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  absent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  excused: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  cancelled: "bg-muted text-muted-foreground",
};

type TicketStatus = "present" | "late" | "absent" | "excused";

interface UnifiedParticipant {
  id: string; name: string; identifier?: string; status: string;
  ticketId?: string; checkinTimestamp?: string | null; isPublic: boolean;
  reservationId?: string; publicReservationId?: string;
  isAssistant?: boolean; assistantRecordId?: string;
  lastName?: string;
}

export default function ProfEventParticipantsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmChange, setConfirmChange] = useState<{
    ticketId?: string; currentStatus: string; newStatus: TicketStatus; studentName: string; isPublic: boolean; reservationId?: string;
  } | null>(null);
  const [cancelReservation, setCancelReservation] = useState<{ id: string; name: string; isPublic: boolean; reservationId?: string } | null>(null);

  // Student assistant state
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false);
  const [assistantSearch, setAssistantSearch] = useState("");
  const [removeAssistantId, setRemoveAssistantId] = useState<string | null>(null);
  const { data: event } = useQuery({
    queryKey: ["prof_part_event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["prof_participants", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, profiles:student_id(id, first_name, last_name, display_name, student_identifier), tickets(*)")
        .eq("event_id", eventId!)
        .neq("status", "cancelled");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!eventId,
  });

  const { data: publicParticipants = [] } = useQuery({
    queryKey: ["prof_public_participants", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_reservations")
        .select("*, public_tickets(*)")
        .eq("event_id", eventId!)
        .eq("status", "reserved");
      if (error) return [];
      return data as any[];
    },
    enabled: !!eventId,
  });

  // Event student assistants
  const { data: assistants = [] } = useQuery({
    queryKey: ["prof_event_assistants", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_student_assistants")
        .select("*")
        .eq("event_id", eventId!);
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
    enabled: !!eventId,
  });

  // Fetch class assignments for all participants + assistants
  const allParticipantStudentIds = [
    ...participants.map((p: any) => p.profiles?.id),
    ...assistants.map((a: any) => a.student_id),
  ].filter(Boolean);
  const uniqueParticipantStudentIds = [...new Set(allParticipantStudentIds)];

  const { data: participantClassAssignments = [] } = useQuery({
    queryKey: ["prof_participant_classes", eventId, uniqueParticipantStudentIds],
    queryFn: async () => {
      if (uniqueParticipantStudentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("student_class_assignments")
        .select("student_id, classes(display_name)")
        .in("student_id", uniqueParticipantStudentIds);
      if (error) throw error;
      return data as any[];
    },
    enabled: uniqueParticipantStudentIds.length > 0,
  });

  const classLookup = new Map<string, string>();
  participantClassAssignments.forEach((a: any) => {
    const dn = a.classes?.display_name || "";
    if (dn && !classLookup.has(a.student_id)) classLookup.set(a.student_id, dn);
  });

  // Searchable students for assistant assignment
  const { data: allStudents = [] } = useQuery({
    queryKey: ["all_students_for_prof_assistant_page"],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (roleError) throw roleError;
      const ids = [...new Set((roleData || []).map((r) => r.user_id))];
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .in("id", ids)
        .eq("is_active", true)
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return data as any[];
    },
    enabled: assistantDialogOpen,
  });

  const assistantIdsSet = new Set(assistants.map((a: any) => a.student_id));
  const availableStudentsForAssistant = allStudents.filter((s: any) => !assistantIdsSet.has(s.id));

  const assignAssistantMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase.from("event_student_assistants").insert({
        event_id: eventId!,
        student_id: studentId,
        assigned_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prof_event_assistants", eventId] });
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
      queryClient.invalidateQueries({ queryKey: ["prof_event_assistants", eventId] });
      toast.success("Elev asistent eliminat");
      setRemoveAssistantId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unified: UnifiedParticipant[] = [
    // Assistants
    ...assistants.map((a: any) => {
      const profile = a.profile;
      return {
        id: `assist-${a.id}`, name: profile?.display_name || `${profile?.last_name || ""} ${profile?.first_name || ""}`.trim(),
        lastName: profile?.last_name || "",
        status: "present", isPublic: false, isAssistant: true, assistantRecordId: a.id,
      } as UnifiedParticipant;
    }),
    ...participants.map((p: any) => {
      const ticket = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets;
      const profile = p.profiles;
      return {
        id: `reg-${p.id}`, name: profile?.display_name || `${profile?.first_name} ${profile?.last_name}`,
        lastName: profile?.last_name || "",
        identifier: profile?.student_identifier, status: ticket?.status || "reserved",
        ticketId: ticket?.id, checkinTimestamp: ticket?.checkin_timestamp, isPublic: false,
        reservationId: p.id,
      };
    }),
    ...publicParticipants.flatMap((pr: any) =>
      (pr.public_tickets || []).filter((t: any) => t.status !== "cancelled").map((t: any) => ({
        id: `pub-${t.id}`, name: t.attendee_name, lastName: t.attendee_name || "",
        status: t.status || "reserved",
        ticketId: t.id, checkinTimestamp: t.checkin_timestamp, isPublic: true,
        publicReservationId: pr.id,
      }))
    ),
  ].sort((a, b) => a.lastName.localeCompare(b.lastName));

  const filtered = unified.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    return true;
  });

  const statusOrder: Record<string, number> = { reserved: 0, present: 1, late: 2, absent: 3, excused: 4 };
  const sorted = [...filtered].sort((a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5));

  const stats = {
    total: unified.length,
    present: unified.filter((p) => p.status === "present").length,
    late: unified.filter((p) => p.status === "late").length,
    absent: unified.filter((p) => p.status === "absent").length,
    reserved: unified.filter((p) => p.status === "reserved").length,
    excused: unified.filter((p) => p.status === "excused").length,
  };

  async function ensureTicket(reservationId: string): Promise<string | null> {
    const { data, error } = await supabase.from("tickets").insert({
      reservation_id: reservationId,
    }).select("id").single();
    if (error) { toast.error("Nu s-a putut crea ticketul: " + error.message); return null; }
    return data.id;
  }

  async function updateStatus(ticketId: string | undefined, currentStatus: string, newStatus: TicketStatus, isPublic: boolean, reservationId?: string) {
    let resolvedTicketId = ticketId;
    if (!resolvedTicketId && !isPublic && reservationId) {
      resolvedTicketId = (await ensureTicket(reservationId)) ?? undefined;
      if (!resolvedTicketId) return;
    }
    if (!resolvedTicketId) { toast.error("Ticketul nu a fost găsit"); return; }

    const table = isPublic ? "public_tickets" : "tickets";
    const { error } = await supabase.from(table).update({
      status: newStatus, checkin_timestamp: ["present", "late"].includes(newStatus) ? new Date().toISOString() : null,
    } as any).eq("id", resolvedTicketId);
    if (error) { toast.error(error.message); return; }
    if (!isPublic) {
      await supabase.from("attendance_log").insert({
        ticket_id: resolvedTicketId, previous_status: currentStatus as any,
        new_status: newStatus, changed_by: user!.id, notes: "Actualizat de profesor",
      });
    }
    queryClient.invalidateQueries({ queryKey: ["prof_participants", eventId] });
    queryClient.invalidateQueries({ queryKey: ["prof_public_participants", eventId] });
    toast.success(`Status actualizat: ${statusLabels[newStatus]}`);
    setConfirmChange(null);
  }

  function handleStatusClick(ticketId: string | undefined, currentStatus: string, newStatus: TicketStatus, studentName: string, isPublic: boolean, reservationId?: string) {
    if (currentStatus !== "reserved") {
      setConfirmChange({ ticketId, currentStatus, newStatus, studentName, isPublic, reservationId });
    } else {
      updateStatus(ticketId, currentStatus, newStatus, isPublic, reservationId);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/prof")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold">{event?.title || "Participanți"}</h1>
          {event && <p className="text-xs text-muted-foreground">{formatDate(event.date)} • {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setAssistantDialogOpen(true); setAssistantSearch(""); }}>
            <UserPlus className="mr-2 h-4 w-4" /> Elev asistent
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            if (!event || unified.length === 0) return;
            exportAttendancePdf(
              event.title,
              formatDate(event.date),
              `${event.start_time?.slice(0, 5)} – ${event.end_time?.slice(0, 5)}`,
              event.location,
              unified,
            );
          }}>
            <FileDown className="mr-2 h-4 w-4" /> Listă de prezență
          </Button>
          <Button size="sm" onClick={() => navigate(`/prof/scan/${eventId}`)}>
            <ScanLine className="mr-2 h-4 w-4" /> Scanează
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 text-center">
        <Card><CardContent className="p-2"><p className="text-lg font-bold">{stats.total}</p><p className="text-[10px] text-muted-foreground">Total</p></CardContent></Card>
        <Card><CardContent className="p-2"><p className="text-lg font-bold text-green-700 dark:text-green-400">{stats.present}</p><p className="text-[10px] text-muted-foreground">Prezenți</p></CardContent></Card>
        <Card><CardContent className="p-2"><p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{stats.late}</p><p className="text-[10px] text-muted-foreground">Întârziați</p></CardContent></Card>
        <Card><CardContent className="p-2"><p className="text-lg font-bold text-red-700 dark:text-red-400">{stats.absent}</p><p className="text-[10px] text-muted-foreground">Absenți</p></CardContent></Card>
        <Card><CardContent className="p-2"><p className="text-lg font-bold text-blue-700 dark:text-blue-400">{stats.reserved}</p><p className="text-[10px] text-muted-foreground">Așteptați</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Caută participant…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate ({stats.total})</SelectItem>
            <SelectItem value="reserved">Rezervat ({stats.reserved})</SelectItem>
            <SelectItem value="present">Prezent ({stats.present})</SelectItem>
            <SelectItem value="late">Întârziat ({stats.late})</SelectItem>
            <SelectItem value="absent">Absent ({stats.absent})</SelectItem>
            <SelectItem value="excused">Motivat ({stats.excused})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Se încarcă…</div>
      ) : sorted.length === 0 ? (
        <Card><CardContent className="py-6 text-center text-muted-foreground">Niciun participant găsit.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((p) => {
            const isExpanded = expandedId === p.id;
            return (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                         <p className="font-medium text-sm truncate">{p.name}</p>
                         {p.isPublic && <Badge variant="outline" className="text-[10px] shrink-0">Vizitator</Badge>}
                         {p.isAssistant && <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] shrink-0">Asistent</Badge>}
                       </div>
                    </div>
                    <Badge variant="secondary" className={`text-xs shrink-0 ${statusColors[p.status]}`}>{statusLabels[p.status]}</Badge>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>
                  {isExpanded && (
                    <div className="border-t px-3 py-3 space-y-3 bg-muted/10">
                      {p.isAssistant ? (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Elevul este asistent la acest eveniment și este marcat automat ca prezent.</p>
                          <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setRemoveAssistantId(p.assistantRecordId!); }}>
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Elimină asistent
                          </Button>
                        </div>
                      ) : (
                        <>
                          {p.checkinTimestamp && <p className="text-xs text-muted-foreground">Check-in: {formatDateTime(p.checkinTimestamp)}</p>}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Schimbă statusul:</p>
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                              <Button size="sm" variant={p.status === "present" ? "default" : "outline"} className="h-9 text-xs" disabled={p.status === "present"}
                                onClick={(e) => { e.stopPropagation(); handleStatusClick(p.ticketId, p.status, "present", p.name, p.isPublic, p.reservationId); }}>
                                 <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Prezent
                               </Button>
                               <Button size="sm" variant={p.status === "late" ? "default" : "outline"} className="h-9 text-xs" disabled={p.status === "late"}
                                 onClick={(e) => { e.stopPropagation(); handleStatusClick(p.ticketId, p.status, "late", p.name, p.isPublic, p.reservationId); }}>
                                 <Clock className="mr-1 h-3.5 w-3.5" /> Întârziat
                               </Button>
                               <Button size="sm" variant={p.status === "absent" ? "destructive" : "outline"} className="h-9 text-xs" disabled={p.status === "absent"}
                                 onClick={(e) => { e.stopPropagation(); handleStatusClick(p.ticketId, p.status, "absent", p.name, p.isPublic, p.reservationId); }}>
                                 <XCircle className="mr-1 h-3.5 w-3.5" /> Absent
                               </Button>
                               <Button size="sm" variant={p.status === "excused" ? "secondary" : "outline"} className="h-9 text-xs" disabled={p.status === "excused"}
                                 onClick={(e) => { e.stopPropagation(); handleStatusClick(p.ticketId, p.status, "excused", p.name, p.isPublic, p.reservationId); }}>
                                 <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Motivat
                              </Button>
                            </div>
                          </div>
                          <div className="pt-2 border-t">
                            <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setCancelReservation({ id: p.isPublic ? p.ticketId : p.reservationId!, name: p.name, isPublic: p.isPublic, reservationId: p.reservationId }); }}>
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Anulează rezervarea
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmChange} onOpenChange={(o) => !o && setConfirmChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmă schimbarea statusului</AlertDialogTitle>
            <AlertDialogDescription>
              Schimbi statusul pentru <strong>{confirmChange?.studentName}</strong> din{" "}
              <strong>{statusLabels[confirmChange?.currentStatus || ""]}</strong> în{" "}
              <strong>{statusLabels[confirmChange?.newStatus || ""]}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmChange && updateStatus(confirmChange.ticketId, confirmChange.currentStatus, confirmChange.newStatus, confirmChange.isPublic, confirmChange.reservationId)}>
              Confirmă
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
              Rezervarea pentru <strong>{cancelReservation?.name}</strong> va fi anulată și locul va fi eliberat.
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
                    const { error } = await supabase.from("public_tickets").update({ status: "cancelled" }).eq("id", cancelReservation.id);
                    if (error) throw error;
                  } else {
                    const { error: resErr } = await supabase.from("reservations").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", cancelReservation.id);
                    if (resErr) throw resErr;
                    await supabase.from("tickets").update({ status: "cancelled" as any }).eq("reservation_id", cancelReservation.id);
                  }
                  queryClient.invalidateQueries({ queryKey: ["prof_participants", eventId] });
                  queryClient.invalidateQueries({ queryKey: ["prof_public_participants", eventId] });
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
                {availableStudentsForAssistant
                  .filter((s: any) => {
                    if (!assistantSearch) return true;
                    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
                    return name.includes(assistantSearch.toLowerCase());
                  })
                  .slice(0, 20)
                  .map((s: any) => (
                    <CommandItem
                      key={s.id}
                      value={`${s.last_name} ${s.first_name}`}
                      onSelect={() => assignAssistantMutation.mutate(s.id)}
                      className="cursor-pointer"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {s.last_name} {s.first_name}
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
