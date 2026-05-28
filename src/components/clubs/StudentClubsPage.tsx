import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowRight, HeartHandshake, Users, CalendarRange, History } from "lucide-react";
import { formatDate } from "@/lib/time";

export default function StudentClubsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") ?? "dashboard";

  const { data: clubs = [], isLoading: loadingClubs } = useQuery({
    queryKey: ["student-clubs-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, description, frequency_label, status, max_capacity")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["student-volunteer-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("volunteer_projects")
        .select("id, name, description, start_date, end_date, status, max_capacity")
        .eq("status", "active")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myClubEnrollments = [] } = useQuery({
    enabled: !!user?.id,
    queryKey: ["student-my-clubs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_enrollments")
        .select("id, club_id, status, enrolled_at, clubs:club_id (id, name, description, frequency_label, status)")
        .eq("student_id", user!.id)
        .eq("status", "enrolled")
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Istoric voluntariat: zile la care a fost prezent
  const { data: volunteerHistory = [] } = useQuery({
    enabled: !!user?.id,
    queryKey: ["student-volunteer-history", user?.id],
    queryFn: async () => {
      const { data: att, error } = await supabase
        .from("volunteer_attendance")
        .select("id, day_id, status, checkin_at, volunteer_days:day_id (id, date, project_id, volunteer_projects:project_id (id, name))")
        .eq("student_id", user!.id)
        .eq("status", "present")
        .order("checkin_at", { ascending: false });
      if (error) throw error;
      return att ?? [];
    },
  });

  const enrolledClubIds = useMemo(
    () => new Set(myClubEnrollments.map((e: any) => e.club_id)),
    [myClubEnrollments],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Cluburi & Voluntariat</h1>
        <p className="text-sm text-muted-foreground">
          Vezi cluburile active și proiectele de voluntariat. Te poți înscrie sau retrage din pagina fiecăruia.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setSp({ tab: v })}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="my-clubs">Cluburile mele</TabsTrigger>
          <TabsTrigger value="volunteer">Voluntariat</TabsTrigger>
        </TabsList>

        {/* === DASHBOARD === */}
        <TabsContent value="dashboard" className="space-y-8 pt-4">
          <Section
            icon={<Users className="h-5 w-5 text-primary" />}
            title="Cluburi active"
            loading={loadingClubs}
            empty="Niciun club activ momentan."
            items={clubs}
            renderCard={(c: any) => (
              <ClubCard
                key={c.id}
                club={c}
                enrolled={enrolledClubIds.has(c.id)}
                onOpen={() => navigate(`/student/clubs/${c.id}`)}
              />
            )}
          />
          <Section
            icon={<HeartHandshake className="h-5 w-5 text-primary" />}
            title="Voluntariat disponibil"
            loading={loadingProjects}
            empty="Niciun proiect de voluntariat disponibil."
            items={projects}
            renderCard={(p: any) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => navigate(`/student/volunteer/${p.id}`)}
              />
            )}
          />
        </TabsContent>

        {/* === CLUBURILE MELE === */}
        <TabsContent value="my-clubs" className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Cluburile mele</h2>
          </div>
          {myClubEnrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nu ești înscris la niciun club. Vezi cluburile active din Dashboard.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myClubEnrollments.map((e: any) =>
                e.clubs ? (
                  <ClubCard
                    key={e.id}
                    club={e.clubs}
                    enrolled
                    onOpen={() => navigate(`/student/clubs/${e.club_id}`)}
                  />
                ) : null,
              )}
            </div>
          )}
        </TabsContent>

        {/* === VOLUNTARIAT === */}
        <TabsContent value="volunteer" className="space-y-8 pt-4">
          <Section
            icon={<HeartHandshake className="h-5 w-5 text-primary" />}
            title="Voluntariat disponibil"
            loading={loadingProjects}
            empty="Niciun proiect de voluntariat disponibil."
            items={projects}
            renderCard={(p: any) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => navigate(`/student/volunteer/${p.id}`)}
              />
            )}
          />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Istoricul participărilor</h2>
            </div>
            {volunteerHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nu ai participări înregistrate la evenimente de voluntariat.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {volunteerHistory.map((h: any) => {
                  const day = h.volunteer_days;
                  const project = day?.volunteer_projects;
                  if (!day || !project) return null;
                  return (
                    <Card key={h.id} className="flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{project.name}</CardTitle>
                          <Badge variant="default">Prezent</Badge>
                        </div>
                        <CardDescription className="text-xs">
                          {formatDate(day.date)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-1 items-end justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/student/volunteer/${project.id}`)}
                        >
                          Vezi proiectul <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Section({
  icon,
  title,
  loading,
  empty,
  items,
  renderCard,
}: {
  icon: React.ReactNode;
  title: string;
  loading: boolean;
  empty: string;
  items: any[];
  renderCard: (item: any) => React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(renderCard)}
        </div>
      )}
    </section>
  );
}

function ClubCard({
  club,
  enrolled,
  onOpen,
}: {
  club: any;
  enrolled?: boolean;
  onOpen: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{club.name}</CardTitle>
          {enrolled && <Badge variant="default">Înscris</Badge>}
        </div>
        {club.frequency_label && (
          <CardDescription className="text-xs flex items-center gap-1">
            <CalendarRange className="h-3 w-3" />
            {club.frequency_label}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {club.description || "Fără descriere"}
        </p>
        <Button size="sm" variant="outline" className="self-end" onClick={onOpen}>
          Deschide <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}

function ProjectCard({ project, onOpen }: { project: any; onOpen: () => void }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{project.name}</CardTitle>
        <CardDescription className="text-xs">
          {formatDate(project.start_date)} – {formatDate(project.end_date)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {project.description || "Fără descriere"}
        </p>
        <Button size="sm" variant="outline" className="self-end" onClick={onOpen}>
          Deschide <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
