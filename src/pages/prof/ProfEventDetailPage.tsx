import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, CalendarDays, Clock, MapPin, Users, UserPlus, X, ScanLine,
  CheckCircle2, XCircle, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  draft: "Ciornă", published: "Publicat", closed: "Închis", cancelled: "Anulat",
  reserved: "Rezervat", present: "Prezent", late: "Întârziat",
  absent: "Absent", excused: "Motivat",
};

export default function ProfEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [coordDialogOpen, setCoordDialogOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [removeCoordId, setRemoveCoordId] = useState<string | null>(null);

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

  // Get teachers + coordinators available for assignment
  const { data: availableTeachers = [] } = useQuery({
    queryKey: ["assignable_teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, first_name, last_name, display_name)")
        .in("role", ["teacher", "coordinator_teacher"]);
      if (error) throw error;
      return (data || []).map((r: any) => r.profiles).filter(Boolean);
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

  const assignedIds = coordinators.map((c: any) => c.teacher_id);
  const unassigned = availableTeachers.filter((t: any) => !assignedIds.includes(t.id));

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

  // Calculate hours per coordinator
  const coordHours = coordinators.map((c: any) => ({
    ...c,
    hours: event?.counted_duration_hours || 0,
  }));

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Se încarcă…</div>;
  if (!event) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate("/prof/events")}><ArrowLeft className="mr-2 h-4 w-4" /> Înapoi</Button>
      <p className="text-muted-foreground">Evenimentul nu a fost găsit.</p>
    </div>
  );

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
          <div><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{event.date}</p></div>
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
          <TabsTrigger value="participants">Participanți ({participants.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="coordinators" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Profesorii care coordonează acest eveniment. Orele evenimentului se contorizează pentru fiecare.</p>
            <Button size="sm" onClick={() => setCoordDialogOpen(true)}>
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
                {coordHours.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Niciun coordonator.</TableCell></TableRow>
                ) : coordHours.map((c: any) => {
                  const p = c.profiles;
                  const name = p?.display_name || `${p?.first_name} ${p?.last_name}`;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>{c.hours}h</TableCell>
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
            <Button size="sm" onClick={() => navigate(`/prof/event/${id}`)}>
              <Users className="mr-2 h-4 w-4" /> Lista completă
            </Button>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Elev</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="py-6 text-center text-muted-foreground">Niciun participant.</TableCell></TableRow>
                ) : participants.map((p: any) => {
                  const profile = p.profiles;
                  const ticket = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets;
                  const name = profile?.display_name || `${profile?.first_name} ${profile?.last_name}`;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{statusLabels[ticket?.status || "reserved"]}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add coordinator dialog */}
      <Dialog open={coordDialogOpen} onOpenChange={(o) => !o && setCoordDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adaugă coordonator</DialogTitle>
            <DialogDescription>Selectează un profesor pentru a-l adăuga ca coordonator.</DialogDescription>
          </DialogHeader>
          <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
            <SelectTrigger><SelectValue placeholder="Selectează profesor" /></SelectTrigger>
            <SelectContent>
              {unassigned.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.display_name || `${t.first_name} ${t.last_name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCoordDialogOpen(false)}>Anulează</Button>
            <Button disabled={!selectedTeacherId || assignMutation.isPending} onClick={() => assignMutation.mutate(selectedTeacherId)}>
              Adaugă
            </Button>
          </div>
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
    </div>
  );
}
