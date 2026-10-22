import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, XCircle } from "lucide-react";
import EventScanScreen from "@/components/scan/EventScanScreen";

export default function StudentScanPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: isAssistant, isLoading } = useQuery({
    queryKey: ["check_assistant", user?.id, eventId],
    queryFn: async () => {
      const { data } = await supabase.from("event_student_assistants").select("id")
        .eq("student_id", user!.id).eq("event_id", eventId!).maybeSingle();
      return !!data;
    },
    enabled: !!user && !!eventId,
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Se verifică…</div>;
  if (!isAssistant) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/student")}><ArrowLeft className="h-4 w-4" /></Button>
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <XCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p>Nu ești asistent la acest eveniment.</p>
        </CardContent></Card>
      </div>
    );
  }
  return <EventScanScreen eventId={eventId} backPath="/student" markNote="Marcat manual de elev asistent" readerId="student-qr-reader" />;
}
