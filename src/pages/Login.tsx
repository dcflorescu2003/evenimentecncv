import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import cncvLogo from "@/assets/cncv-logo.jpg";

export default function Login() {
  const { session, roles, profile, signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: publicEvents = [] } = useQuery({
    queryKey: ["public_events_login"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date, start_time, end_time, location, max_capacity, description")
        .eq("is_public", true)
        .eq("published", true)
        .eq("status", "published")
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: reservationCounts = {} } = useQuery({
    queryKey: ["public_events_login_counts", publicEvents.map((e) => e.id).join(",")],
    queryFn: async () => {
      const eventIds = publicEvents.map((e) => e.id);
      if (eventIds.length === 0) return {};
      const { data, error } = await supabase.rpc("get_events_reserved_counts", {
        _event_ids: eventIds,
      });
      if (error) throw error;
      return (data as Record<string, number>) || {};
    },
    enabled: publicEvents.length > 0,
  });

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (session && profile) {
    // Force password change if needed
    if (profile.must_change_password) {
      return <Navigate to="/change-password" replace />;
    }
    if (roles.includes("admin")) return <Navigate to="/admin" replace />;
    if (roles.includes("manager")) return <Navigate to="/manager" replace />;
    if (roles.includes("teacher")) return <Navigate to="/prof" replace />;
    if (roles.includes("homeroom_teacher")) return <Navigate to="/prof" replace />;
    if (roles.includes("student")) return <Navigate to="/student" replace />;
    if (roles.includes("coordinator_teacher")) return <Navigate to="/coordinator" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(username.trim(), password);
    if (error) {
      setError("Nume de utilizator sau parolă incorectă.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-3">
          <img src={cncvLogo} alt="Logo CNCV" className="mx-auto h-16 w-16 object-contain" />
          <CardTitle className="font-display text-2xl">Colegiul Național Cantemir Vodă</CardTitle>
          <CardDescription>Platformă de gestiune activități școlare</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nume utilizator</Label>
              <Input
                id="username"
                placeholder="ex: c.ion.popescu"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Parolă</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Autentificare
            </Button>
          </form>
        </CardContent>
    </Card>

      {publicEvents.length > 0 && (
        <section className="w-full">
          <h2 className="text-lg font-semibold text-center mb-3">Evenimente publice</h2>
          <div className="space-y-3">
            {publicEvents.map((e) => {
              const availableSeats = Math.max(0, e.max_capacity - (reservationCounts[e.id] || 0));

              return (
                <Card key={e.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-1">
                    <p className="font-semibold">{e.title}</p>
                    {e.description && <p className="text-xs text-muted-foreground line-clamp-1">{e.description}</p>}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(e.date)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.start_time?.slice(0, 5)} – {e.end_time?.slice(0, 5)}</span>
                      {e.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{availableSeats} / {e.max_capacity} locuri libere</span>
                    </div>
                    <Button size="sm" className="mt-2 w-full" onClick={() => navigate(`/public/events/${e.id}`)}>Rezervă</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
