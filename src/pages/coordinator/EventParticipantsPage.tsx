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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, ScanLine, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
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

export default function EventParticipantsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

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
        .select("*, profiles:student_id(id, first_name, last_name, display_name), tickets(*)")
        .eq("event_id", eventId!)
        .neq("status", "cancelled");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!eventId,
  });

  const filtered = participants.filter((p: any) => {
    const profile = p.profiles;
    if (!profile) return false;
    const name = `${profile.first_name} ${profile.last_name}`.toLowerCase();
    const display = (profile.display_name || "").toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !display.includes(search.toLowerCase())) return false;
    if (filterStatus !== "all") {
      const ticket = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets;
      if (ticket?.status !== filterStatus) return false;
    }
    return true;
  });

  const stats = {
    total: participants.length,
    present: participants.filter((p: any) => { const t = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets; return t?.status === "present"; }).length,
    late: participants.filter((p: any) => { const t = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets; return t?.status === "late"; }).length,
    absent: participants.filter((p: any) => { const t = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets; return t?.status === "absent"; }).length,
    reserved: participants.filter((p: any) => { const t = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets; return t?.status === "reserved"; }).length,
  };

  async function updateStatus(ticketId: string, currentStatus: string, newStatus: TicketStatus) {
    const { error } = await supabase
      .from("tickets")
      .update({
        status: newStatus,
        checkin_timestamp: ["present", "late"].includes(newStatus) ? new Date().toISOString() : null,
      })
      .eq("id", ticketId);
    if (error) { toast.error(error.message); return; }

    await supabase.from("attendance_log").insert({
      ticket_id: ticketId,
      previous_status: currentStatus as any,
      new_status: newStatus,
      changed_by: user!.id,
      notes: "Actualizat din lista participanți",
    });

    queryClient.invalidateQueries({ queryKey: ["event_participants", eventId] });
    toast.success("Status actualizat");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/coordinator")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold">{event?.title || "Participanți"}</h1>
          {event && <p className="text-xs text-muted-foreground">{event.date} • {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}</p>}
        </div>
        <Button size="sm" onClick={() => navigate(`/coordinator/scan/${eventId}`)}>
          <ScanLine className="mr-2 h-4 w-4" /> Scanează
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <Card><CardContent className="p-2">
          <p className="text-lg font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-2">
          <p className="text-lg font-bold text-green-700 dark:text-green-400">{stats.present}</p>
          <p className="text-xs text-muted-foreground">Prezenți</p>
        </CardContent></Card>
        <Card><CardContent className="p-2">
          <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{stats.late}</p>
          <p className="text-xs text-muted-foreground">Întârziați</p>
        </CardContent></Card>
        <Card><CardContent className="p-2">
          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{stats.reserved}</p>
          <p className="text-xs text-muted-foreground">Așteptați</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Caută elev…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate</SelectItem>
            <SelectItem value="reserved">Rezervat</SelectItem>
            <SelectItem value="present">Prezent</SelectItem>
            <SelectItem value="late">Întârziat</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="excused">Motivat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Participant List */}
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Se încarcă…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-6 text-center text-muted-foreground">Niciun participant găsit.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => {
            const profile = p.profiles;
            const ticket = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets;
            const name = profile?.display_name || `${profile?.first_name} ${profile?.last_name}`;

            return (
              <Card key={p.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{name}</span>
                    {ticket && (
                      <Badge variant="secondary" className={`text-xs ${statusColors[ticket.status]}`}>
                        {statusLabels[ticket.status]}
                      </Badge>
                    )}
                  </div>
                  {ticket && ticket.status === "reserved" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" className="flex-1 h-8 text-xs" onClick={() => updateStatus(ticket.id, ticket.status, "present")}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Prezent
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => updateStatus(ticket.id, ticket.status, "late")}>
                        <Clock className="mr-1 h-3 w-3" /> Întârziat
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => updateStatus(ticket.id, ticket.status, "absent")}>
                        <XCircle className="mr-1 h-3 w-3" /> Absent
                      </Button>
                    </div>
                  )}
                  {ticket && ticket.checkin_timestamp && (
                    <p className="text-xs text-muted-foreground">
                      Check-in: {new Date(ticket.checkin_timestamp).toLocaleString("ro-RO")}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
