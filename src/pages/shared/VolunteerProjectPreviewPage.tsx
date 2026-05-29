import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, Eye } from "lucide-react";
import { formatDate } from "@/lib/time";

export default function VolunteerProjectPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: project, isLoading } = useQuery({
    queryKey: ["volunteer_preview", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("volunteer_projects")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: days = [] } = useQuery({
    queryKey: ["volunteer_preview_days", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("volunteer_days")
        .select("id, date, start_time, end_time, location")
        .eq("project_id", id!)
        .order("date");
      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Se încarcă…</div>;
  }
  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi
        </Button>
        <p className="text-muted-foreground">Proiectul nu a fost găsit.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi
      </Button>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-display text-xl font-bold">{project.name}</h1>
          <Badge className="bg-secondary text-secondary-foreground text-xs">Voluntariat</Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <Eye className="h-3 w-3" /> Vizualizare
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          <CalendarDays className="h-3 w-3" />
          {formatDate(project.start_date)} – {formatDate(project.end_date)}
        </Badge>
        {project.location && (
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" /> {project.location}
          </Badge>
        )}
        {project.max_capacity != null && (
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" /> Maxim {project.max_capacity} voluntari
          </Badge>
        )}
      </div>

      {project.description && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm whitespace-pre-wrap">{project.description}</p>
          </CardContent>
        </Card>
      )}

      {days.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Zile programate</p>
            <div className="space-y-1.5">
              {days.map((d: any) => (
                <div key={d.id} className="text-sm flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" /> {formatDate(d.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {d.start_time?.slice(0, 5)} – {d.end_time?.slice(0, 5)}
                  </span>
                  {d.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {d.location}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground italic">
        Vizualizare informativă. Înscrierile sunt disponibile doar pentru elevi.
      </p>
    </div>
  );
}
