import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  username: string;
}

export default function PortfolioStudentListPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: cls } = useQuery({
    queryKey: ["portfolio_class_info", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, display_name, academic_year")
        .eq("id", classId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["portfolio_class_students", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data: assignments, error: aErr } = await supabase
        .from("student_class_assignments")
        .select("student_id")
        .eq("class_id", classId!);
      if (aErr) throw aErr;
      const ids = (assignments ?? []).map((a) => a.student_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name, username")
        .in("id", ids)
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const filtered = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.last_name.toLowerCase().includes(q) ||
      s.first_name.toLowerCase().includes(q) ||
      s.username.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/portfolio/classes")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Înapoi
        </Button>
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold">
          {cls?.display_name ?? "Clasă"}
        </h1>
        {cls && (
          <p className="text-sm text-muted-foreground mt-1">
            An școlar {cls.academic_year} · {students.length} elevi
          </p>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Caută elev…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {students.length === 0 ? "Nu există elevi în această clasă." : "Niciun elev găsit."}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border divide-y bg-card">
          {filtered.map((s) => (
            <Link
              key={s.id}
              to={`/portfolio/classes/${classId}/students/${s.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {s.last_name} {s.first_name}
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {s.username}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
