import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  ArrowLeft, Search, ScanLine, CheckCircle2, Clock, XCircle, AlertCircle, ShieldAlert, ChevronDown, ChevronUp, UserCircle,
} from "lucide-react";
import { toast } from "sonner";

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
  id: string;
  name: string;
  identifier?: string;
  status: string;
  ticketId: string;
  checkinTimestamp?: string | null;
  isPublic: boolean;
}

export default function EventParticipantsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmChange, setConfirmChange] = useState<{
    ticketId: string;
    currentStatus: string;
    newStatus: TicketStatus;
    studentName: string;
    isPublic: boolean;
  } | null>(null);

  const { data: event } = useQuery({
    queryKey: ["coord_event_detail", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["event_participants", eventId],
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
    queryKey: ["event_public_participants", eventId],
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

  // Unify participants
  const unified: UnifiedParticipant[] = [
    ...participants.map((p: any) => {
      const ticket = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets;
      const profile = p.profiles;
      return {
        id: `reg-${p.id}`,
        name: profile?.display_name || `${profile?.first_name} ${profile?.last_name}`,
        lastName: profile?.last_name || "",
        identifier: profile?.student_identifier,
        status: ticket?.status || "reserved",
        ticketId: ticket?.id,
        checkinTimestamp: ticket?.checkin_timestamp,
        isPublic: false,
      };
    }),
    ...publicParticipants.flatMap((pr: any) =>
      (pr.public_tickets || []).map((t: any) => ({
        id: `pub-${t.id}`,
        name: t.attendee_name,
        lastName: t.attendee_name || "",
        identifier: undefined,
        status: t.status || "reserved",
        ticketId: t.id,
        checkinTimestamp: t.checkin_timestamp,
        isPublic: true,
      }))
    ),
  ].sort((a, b) => a.lastName.localeCompare(b.lastName));

  const filtered = unified.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.identifier || "").toLowerCase().includes(search.toLowerCase())) return false;
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

  async function updateStatus(ticketId: string, currentStatus: string, newStatus: TicketStatus, isPublic: boolean) {
    const table = isPublic ? "public_tickets" : "tickets";
    const { error } = await supabase
      .from(table)
      .update({
        status: newStatus,
        checkin_timestamp: ["present", "late"].includes(newStatus) ? new Date().toISOString() : null,
      } as any)
      .eq("id", ticketId);
    if (error) { toast.error(error.message); return; }

    if (!isPublic) {
      await supabase.from("attendance_log").insert({
        ticket_id: ticketId,
        previous_status: currentStatus as any,
        new_status: newStatus,
        changed_by: user!.id,
        notes: "Actualizat din lista participanți",
      });
    }

    queryClient.invalidateQueries({ queryKey: ["event_participants", eventId] });
    queryClient.invalidateQueries({ queryKey: ["event_public_participants", eventId] });
    toast.success(`Status actualizat: ${statusLabels[newStatus]}`);
    setConfirmChange(null);
  }

  function handleStatusClick(ticketId: string, currentStatus: string, newStatus: TicketStatus, studentName: string, isPublic: boolean) {
    if (currentStatus !== "reserved") {
      setConfirmChange({ ticketId, currentStatus, newStatus, studentName, isPublic });
    } else {
      updateStatus(ticketId, currentStatus, newStatus, isPublic);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/coordinator")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold">{event?.title || "Participanți"}</h1>
          {event && <p className="text-xs text-muted-foreground">{event.date} • {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)} • {event.location}</p>}
        </div>
        <Button size="sm" onClick={() => navigate(`/coordinator/scan/${eventId}`)}>
          <ScanLine className="mr-2 h-4 w-4" /> Scanează
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2 text-center">
        <Card><CardContent className="p-2">
          <p className="text-lg font-bold">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-2">
          <p className="text-lg font-bold text-green-700 dark:text-green-400">{stats.present}</p>
          <p className="text-[10px] text-muted-foreground">Prezenți</p>
        </CardContent></Card>
        <Card><CardContent className="p-2">
          <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{stats.late}</p>
          <p className="text-[10px] text-muted-foreground">Întârziați</p>
        </CardContent></Card>
        <Card><CardContent className="p-2">
          <p className="text-lg font-bold text-red-700 dark:text-red-400">{stats.absent}</p>
          <p className="text-[10px] text-muted-foreground">Absenți</p>
        </CardContent></Card>
        <Card><CardContent className="p-2">
          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{stats.reserved}</p>
          <p className="text-[10px] text-muted-foreground">Așteptați</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Caută participant…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
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

      {/* Participant List */}
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
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        {p.isPublic && <Badge variant="outline" className="text-[10px] shrink-0">Vizitator</Badge>}
                      </div>
                      {p.identifier && <p className="text-xs text-muted-foreground">{p.identifier}</p>}
                    </div>
                    <Badge variant="secondary" className={`text-xs shrink-0 ${statusColors[p.status]}`}>
                      {statusLabels[p.status]}
                    </Badge>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>

                  {isExpanded && p.ticketId && (
                    <div className="border-t px-3 py-3 space-y-3 bg-muted/10">
                      {p.checkinTimestamp && (
                        <p className="text-xs text-muted-foreground">
                          Check-in: {formatDateTime(p.checkinTimestamp)}
                        </p>
                      )}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Schimbă statusul:</p>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          <Button size="sm" variant={p.status === "present" ? "default" : "outline"} className="h-9 text-xs" disabled={p.status === "present"}
                            onClick={(e) => { e.stopPropagation(); handleStatusClick(p.ticketId, p.status, "present", p.name, p.isPublic); }}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Prezent
                          </Button>
                          <Button size="sm" variant={p.status === "late" ? "default" : "outline"} className="h-9 text-xs" disabled={p.status === "late"}
                            onClick={(e) => { e.stopPropagation(); handleStatusClick(p.ticketId, p.status, "late", p.name, p.isPublic); }}>
                            <Clock className="mr-1 h-3.5 w-3.5" /> Întârziat
                          </Button>
                          <Button size="sm" variant={p.status === "absent" ? "destructive" : "outline"} className="h-9 text-xs" disabled={p.status === "absent"}
                            onClick={(e) => { e.stopPropagation(); handleStatusClick(p.ticketId, p.status, "absent", p.name, p.isPublic); }}>
                            <XCircle className="mr-1 h-3.5 w-3.5" /> Absent
                          </Button>
                          <Button size="sm" variant={p.status === "excused" ? "secondary" : "outline"} className="h-9 text-xs" disabled={p.status === "excused"}
                            onClick={(e) => { e.stopPropagation(); handleStatusClick(p.ticketId, p.status, "excused", p.name, p.isPublic); }}>
                            <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Motivat
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm status override dialog */}
      <AlertDialog open={!!confirmChange} onOpenChange={(o) => !o && setConfirmChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmă schimbarea statusului</AlertDialogTitle>
            <AlertDialogDescription>
              Schimbi statusul pentru <strong>{confirmChange?.studentName}</strong> din{" "}
              <strong>{statusLabels[confirmChange?.currentStatus || ""]}</strong> în{" "}
              <strong>{statusLabels[confirmChange?.newStatus || ""]}</strong>.
              Această acțiune va fi înregistrată în jurnal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmChange && updateStatus(confirmChange.ticketId, confirmChange.currentStatus, confirmChange.newStatus, confirmChange.isPublic)}
            >
              Confirmă
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
