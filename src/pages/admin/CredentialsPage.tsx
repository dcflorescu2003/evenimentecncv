import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { FileDown, Loader2, User, Users, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const roleLabels: Record<string, string> = {
  admin: "Administratori",
  student: "Elevi",
  homeroom_teacher: "Diriginți",
  coordinator_teacher: "Asistenți",
  teacher: "Profesori",
};

interface CredentialResult {
  first_name: string;
  last_name: string;
  username: string;
  password: string;
  error?: string;
}

// jsPDF default fonts don't support Romanian diacritics — strip them
function stripDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0163/g, "t").replace(/\u0162/g, "T").replace(/\u015f/g, "s").replace(/\u015e/g, "S");
}

function generatePDF(results: CredentialResult[], title: string) {
  const doc = new jsPDF();
  const cleanTitle = stripDiacritics(title);

  doc.setFontSize(16);
  doc.text(cleanTitle, 14, 20);

  doc.setFontSize(9);
  doc.text(`Generat: ${new Date().toLocaleDateString("ro-RO")}`, 14, 28);

  autoTable(doc, {
    startY: 34,
    head: [["Nr.", "Nume", "Prenume", "Utilizator", "Parola"]],
    body: results.map((r, i) => [
      i + 1,
      stripDiacritics(r.last_name),
      stripDiacritics(r.first_name),
      r.username,
      r.password || "(eroare)",
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [41, 65, 122] },
  });

  doc.save(`credentiale_${cleanTitle.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}

export default function CredentialsPage() {
  const [mode, setMode] = useState<"user" | "class" | "role">("class");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Fetch all profiles for single-user picker
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username")
        .order("last_name");
      return data || [];
    },
  });

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, display_name")
        .eq("is_active", true)
        .order("display_name");
      return data || [];
    },
  });

  const getTitle = () => {
    if (mode === "user") {
      const p = profiles.find((p) => p.id === selectedUser);
      return p ? `${p.last_name} ${p.first_name}` : "Utilizator";
    }
    if (mode === "class") {
      const c = classes.find((c) => c.id === selectedClass);
      return c ? `Clasa ${c.display_name}` : "Clasă";
    }
    return roleLabels[selectedRole] || "Rol";
  };

  const canGenerate =
    (mode === "user" && selectedUser) ||
    (mode === "class" && selectedClass) ||
    (mode === "role" && selectedRole);

  const handleGenerate = async () => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      let action = "";
      let body: Record<string, string> = {};

      if (mode === "user") {
        action = "reset_single_user";
        body = { user_id: selectedUser };
      } else if (mode === "class") {
        action = "batch_reset_class_passwords";
        body = { class_id: selectedClass };
      } else {
        action = "batch_reset_by_role";
        body = { role: selectedRole };
      }

      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action, ...body },
      });

      if (error) throw error;

      const results: CredentialResult[] = data.results || [];
      if (results.length === 0) {
        toast.warning("Nu s-au găsit utilizatori.");
        return;
      }

      generatePDF(results, getTitle());
      toast.success(`PDF generat cu ${results.length} credențiale.`);
    } catch (err: any) {
      toast.error(err.message || "Eroare la generare");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generare credențiale PDF</h1>
        <p className="text-muted-foreground">
          Resetează parolele și descarcă un PDF cu credențialele de acces.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card
          className={`cursor-pointer transition-all ${mode === "user" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setMode("user")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5" /> Un singur utilizator
            </CardTitle>
            <CardDescription>Generează credențiale pentru un utilizator specific</CardDescription>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${mode === "class" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setMode("class")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-5 w-5" /> O clasă întreagă
            </CardTitle>
            <CardDescription>Resetează parolele tuturor elevilor din clasă</CardDescription>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${mode === "role" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setMode("role")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" /> Un rol întreg
            </CardTitle>
            <CardDescription>Resetează parolele tuturor utilizatorilor cu un anumit rol</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {mode === "user" && (
            <div className="space-y-2">
              <Label>Selectează utilizatorul</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Caută un utilizator..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.last_name} {p.first_name} ({p.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "class" && (
            <div className="space-y-2">
              <Label>Selectează clasa</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege o clasă..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "role" && (
            <div className="space-y-2">
              <Label>Selectează rolul</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege un rol..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!canGenerate || loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Generează PDF
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmare resetare parole</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune va reseta parolele pentru <strong>{getTitle()}</strong>. 
              Parolele vechi nu vor mai funcționa. Sigur doriți să continuați?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate}>
              Da, resetează și generează PDF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
