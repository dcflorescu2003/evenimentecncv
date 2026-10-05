import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NormProgressCard({ sessionId: controlled, hideSelector }: { sessionId?: string; hideSelector?: boolean } = {}) {
  const { user, profile } = useAuth();
  const norm = Number(profile?.teaching_norm) || 0;
  const [internal, setSessionId] = useState<string>("");

  const { data: sessions = [] } = useQuery({
    queryKey: ["program_sessions_norm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_sessions").select("id, name, status, start_date").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!internal && sessions.length) {
      setSessionId((sessions.find((s) => s.status === "active") ?? sessions[0]).id);
    }
  }, [sessions, internal]);

  useEffect(() => { if (controlled) setSessionId(controlled); }, [controlled]);
  const sessionId = controlled || internal;

  const { data: stats } = useQuery({
    queryKey: ["norm_progress", user?.id, sessionId],
    enabled: !!user && !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordinator_assignments")
        .select("events!inner(counted_duration_hours, status, date, session_id)")
        .eq("teacher_id", user!.id)
        .eq("events.session_id", sessionId);
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      let done = 0, planned = 0;
      for (const row of (data ?? []) as any[]) {
        const e = row.events;
        if (!e || e.status === "draft" || e.status === "cancelled") continue;
        const h = e.counted_duration_hours || 0;
        if (e.status === "closed" || e.date < today) done += h; else planned += h;
      }
      return { done, planned };
    },
  });

  const total = (stats?.done ?? 0) + (stats?.planned ?? 0);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-sm font-medium">Norma de ore (coordonare)</p>
          {!hideSelector && (
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="w-full sm:w-64 h-8"><SelectValue placeholder="Sesiune" /></SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}{s.status !== "active" ? " (inactivă)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}
        </div>
        {norm > 0 ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xl font-bold">{total}h / {norm}h</span>
              <Badge variant={total >= norm ? "default" : "secondary"}>
                {total >= norm ? "Normă acoperită" : `Lipsesc ${norm - total}h`}
              </Badge>
            </div>
            <Progress value={Math.min(100, (total / norm) * 100)} className="h-2" />
          </>
        ) : (
          <p className="text-2xl font-bold">{total}h <span className="text-sm font-normal text-muted-foreground">· Normă nesetată</span></p>
        )}
        <p className="text-xs text-muted-foreground">
          Desfășurate: {stats?.done ?? 0}h · Programate: {stats?.planned ?? 0}h
        </p>
      </CardContent>
    </Card>
  );
}
