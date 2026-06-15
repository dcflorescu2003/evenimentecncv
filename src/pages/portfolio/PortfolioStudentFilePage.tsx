import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import StudentPortfolioItemsTab from "@/components/portfolio/StudentPortfolioItemsTab";
import StudentAssignmentsTab from "@/components/portfolio/StudentAssignmentsTab";
import StudentInvolvementListForTeacher from "@/components/portfolio/StudentInvolvementListForTeacher";
import StudentCompetitionsListForTeacher from "@/components/portfolio/StudentCompetitionsListForTeacher";

interface Note {
  id: string;
  note: string;
  created_at: string;
}

function ComingSoon({ stage }: { stage: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-sm text-muted-foreground">
        Această secțiune va fi disponibilă în {stage}.
      </CardContent>
    </Card>
  );
}

export default function PortfolioStudentFilePage() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [newNote, setNewNote] = useState("");

  const { data: student } = useQuery({
    queryKey: ["portfolio_student_info", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username")
        .eq("id", studentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["portfolio_student_notes", studentId, user?.id],
    enabled: !!studentId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_student_notes")
        .select("id, note, created_at")
        .eq("student_id", studentId!)
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("portfolio_student_notes").insert({
        teacher_id: user!.id,
        student_id: studentId!,
        note: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_student_notes", studentId, user?.id] });
      setNewNote("");
      toast.success("Observație salvată");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolio_student_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_student_notes", studentId, user?.id] });
      toast.success("Observație ștearsă");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/portfolio/classes/${classId}`)}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Înapoi la clasă
        </Button>
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold">
          {student ? `${student.last_name} ${student.first_name}` : "Elev"}
        </h1>
        {student && (
          <p className="text-sm text-muted-foreground mt-1 font-mono">{student.username}</p>
        )}
      </div>

      <Tabs defaultValue="portfolio" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="portfolio">Portofoliu</TabsTrigger>
          <TabsTrigger value="assignments">Teme</TabsTrigger>
          <TabsTrigger value="involvement">Implicare</TabsTrigger>
          <TabsTrigger value="competitions">Concursuri</TabsTrigger>
          <TabsTrigger value="notes">Observații</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="mt-4">
          {studentId && <StudentPortfolioItemsTab studentId={studentId} />}
        </TabsContent>
        <TabsContent value="assignments" className="mt-4">
          {studentId && <StudentAssignmentsTab studentId={studentId} />}
        </TabsContent>
        <TabsContent value="involvement" className="mt-4">
          {studentId && <StudentInvolvementListForTeacher studentId={studentId} />}
        </TabsContent>
        <TabsContent value="competitions" className="mt-4">
          {studentId && <StudentCompetitionsListForTeacher studentId={studentId} />}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Adaugă o observație internă (vizibilă doar pentru tine)…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
            />
            <Button
              disabled={!newNote.trim() || addNote.isPending}
              onClick={() => addNote.mutate(newNote.trim())}
            >
              <Plus className="h-4 w-4 mr-2" />
              {addNote.isPending ? "Se salvează…" : "Adaugă observație"}
            </Button>
          </div>

          {notes.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nicio observație încă.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <Card key={n.id}>
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm whitespace-pre-wrap break-words">{n.note}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(n.created_at).toLocaleString("ro-RO", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Șterge"
                      onClick={() => deleteNote.mutate(n.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
