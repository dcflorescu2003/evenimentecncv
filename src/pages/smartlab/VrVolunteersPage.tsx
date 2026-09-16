import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, X, Loader2 } from "lucide-react";

interface ClassRow {
  id: string;
  display_name: string;
}

export default function VrVolunteersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: classes, isLoading } = useQuery({
    queryKey: ["vr-vol-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, display_name, grade_number, section")
        .eq("is_active", true)
        .order("grade_number")
        .order("section");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  const { data: volunteers } = useQuery({
    queryKey: ["vr-volunteers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vr_volunteers")
        .select("id, class_id, student_id, profiles:student_id(first_name, last_name)")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        class_id: string;
        student_id: string;
        profiles: { first_name: string; last_name: string } | null;
      }[];
    },
  });

  async function removeVolunteer(id: string) {
    const { error } = await supabase.from("vr_volunteers").delete().eq("id", id);
    if (error) {
      toast({ title: "Nu am putut elimina voluntarul.", variant: "destructive" });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["vr-volunteers"] });
  }

  async function addVolunteer(classId: string, studentId: string) {
    const { error } = await supabase
      .from("vr_volunteers")
      .insert({ class_id: classId, student_id: studentId, assigned_by: user?.id ?? null });
    if (error) {
      toast({
        title: error.message.includes("duplicate")
          ? "Elevul este deja voluntar la această clasă."
          : "Nu am putut adăuga voluntarul.",
        variant: "destructive",
      });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["vr-volunteers"] });
    toast({ title: "Voluntar adăugat." });
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Voluntari Smart Lab</h1>
        <p className="text-sm text-muted-foreground">
          Elevii selectați primesc notificare când un profesor rezervă echipamentul pentru clasa lor.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(classes ?? []).map((c) => {
          const list = (volunteers ?? []).filter((v) => v.class_id === c.id);
          return (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{c.display_name}</CardTitle>
                <StudentPicker classId={c.id} onPick={(sid) => addVolunteer(c.id, sid)} />
              </CardHeader>
              <CardContent>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Niciun voluntar.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {list.map((v) => (
                      <Badge key={v.id} variant="secondary" className="gap-1 py-1">
                        {v.profiles ? `${v.profiles.last_name} ${v.profiles.first_name}` : "Elev"}
                        <button
                          type="button"
                          onClick={() => removeVolunteer(v.id)}
                          aria-label="Elimină voluntarul"
                          className="ml-1 rounded-full hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StudentPicker({ classId, onPick }: { classId: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  const { data: students, isLoading } = useQuery({
    queryKey: ["vr-class-students", classId],
    enabled: open,
    queryFn: async () => {
      const { data: assign, error } = await supabase
        .from("student_class_assignments")
        .select("student_id, profiles:student_id(id, first_name, last_name)")
        .eq("class_id", classId);
      if (error) throw error;
      return ((assign ?? []) as unknown as {
        profiles: { id: string; first_name: string; last_name: string } | null;
      }[])
        .map((a) => a.profiles)
        .filter(Boolean)
        .sort((a, b) => a!.last_name.localeCompare(b!.last_name, "ro")) as {
        id: string;
        first_name: string;
        last_name: string;
      }[];
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Adaugă
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-50 w-72 bg-popover p-0" align="end">
        <Command>
          <CommandInput placeholder="Caută elev..." />
          <CommandList>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>Niciun elev găsit.</CommandEmpty>
                <CommandGroup>
                  {(students ?? []).map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`${s.last_name} ${s.first_name}`}
                      onSelect={() => {
                        onPick(s.id);
                        setOpen(false);
                      }}
                    >
                      {s.last_name} {s.first_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
