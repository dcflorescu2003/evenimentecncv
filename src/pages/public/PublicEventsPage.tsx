import { formatDate } from "@/lib/time";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PublicEventsPage() {
  const navigate = useNavigate();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["public_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_public", true)
        .eq("published", true)
        .eq("status", "published")
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold">Evenimente publice</h1>
          <p className="mt-2 text-muted-foreground">Rezervă-ți locul la evenimentele noastre deschise publicului.</p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Se încarcă…</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">Nu sunt evenimente publice disponibile momentan.</div>
        ) : (
          <div className="space-y-4">
            {events.map((e) => (
              <Card key={e.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <h2 className="text-lg font-semibold">{e.title}</h2>
                      {e.description && <p className="text-sm text-muted-foreground line-clamp-2">{e.description}</p>}
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{formatDate(e.date)}</span>
                        <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{e.start_time?.slice(0, 5)} – {e.end_time?.slice(0, 5)}</span>
                        {e.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{e.location}</span>}
                        <span className="flex items-center gap-1"><Users className="h-4 w-4" />{e.max_capacity} locuri</span>
                      </div>
                    </div>
                    <Button onClick={() => navigate(`/public/events/${e.id}`)}>Rezervă</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="link" onClick={() => navigate("/login")}>Ai cont? Autentifică-te</Button>
        </div>
      </div>
    </div>
  );
}
