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
import { FileDown, Loader2, User, Users, GraduationCap, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFileMobileSafe } from "@/lib/download";

const roleLabels: Record<string, string> = {
  admin: "Administratori",
  student: "Elevi",
  homeroom_teacher: "Diriginți",
  coordinator_teacher: "Asistenți",
  teacher: "Profesori",
  manager: "Manageri",
  cse: "Membri CSE",
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

async function generateCredentialsPDF(results: CredentialResult[], title: string) {
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

  const filename = `credentiale_${cleanTitle.replace(/\s+/g, "_").toLowerCase()}.pdf`;
  const pdfOutput = doc.output("datauristring");
  const base64Data = pdfOutput.split(",")[1];
  await downloadFileMobileSafe(filename, base64Data, "application/pdf");
}

async function generateUserListPDF(users: { first_name: string; last_name: string; username: string }[], title: string) {
  const doc = new jsPDF();
  const cleanTitle = stripDiacritics(`Utilizatori - ${title}`);

  doc.setFontSize(16);
  doc.text(cleanTitle, 14, 20);

  doc.setFontSize(9);
  doc.text(`Generat: ${new Date().toLocaleDateString("ro-RO")}`, 14, 28);

  autoTable(doc, {
    startY: 34,
    head: [["Nr.", "Nume", "Prenume", "Utilizator"]],
    body: users.map((u, i) => [
      i + 1,
      stripDiacritics(u.last_name),
      stripDiacritics(u.first_name),
      u.username,
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [41, 65, 122] },
  });

  const filename = `utilizatori_${cleanTitle.replace(/\s+/g, "_").toLowerCase()}.pdf`;
  const pdfOutput = doc.output("datauristring");
  const base64Data = pdfOutput.split(",")[1];
  await downloadFileMobileSafe(filename, base64Data, "application/pdf");
}

export default function CredentialsPage() {
  const [mode, setMode] = useState<"user" | "class" | "role">("class");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Fetch all profiles for single-user picker
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const batchSize = 1000;
      let allData: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, username")
          .order("last_name")
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return allData;
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

      await generateCredentialsPDF(results, getTitle());
      toast.success(`PDF generat cu ${results.length} credențiale.`);
    } catch (err: any) {
      toast.error(err.message || "Eroare la generare");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateUserList = async () => {
    setLoadingList(true);
    try {
      let users: { first_name: string; last_name: string; username: string }[] = [];

      if (mode === "user") {
        const p = profiles.find((p: any) => p.id === selectedUser);
        if (p) users = [{ first_name: p.first_name, last_name: p.last_name, username: p.username }];
      } else if (mode === "class") {
        // Get students in class
        const { data: assignments } = await supabase
          .from("student_class_assignments")
          .select("student_id")
          .eq("class_id", selectedClass);
        if (assignments && assignments.length > 0) {
          const studentIds = assignments.map((a) => a.student_id);
          // Fetch in batches of 100 for the IN filter
          const batchSize = 100;
          for (let i = 0; i < studentIds.length; i += batchSize) {
            const batch = studentIds.slice(i, i + batchSize);
            const { data: profs } = await supabase
              .from("profiles")
              .select("first_name, last_name, username")
              .in("id", batch)
              .order("last_name");
            if (profs) users.push(...profs);
          }
          users.sort((a, b) => a.last_name.localeCompare(b.last_name, "ro") || a.first_name.localeCompare(b.first_name, "ro"));
        }
      } else if (mode === "role") {
        // Get users with this role
        const { data: roleUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", selectedRole as any);
        if (roleUsers && roleUsers.length > 0) {
          const userIds = roleUsers.map((r) => r.user_id);
          const batchSize = 100;
          for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize);
            const { data: profs } = await supabase
              .from("profiles")
              .select("first_name, last_name, username")
              .in("id", batch)
              .order("last_name");
            if (profs) users.push(...profs);
          }
          users.sort((a, b) => a.last_name.localeCompare(b.last_name, "ro") || a.first_name.localeCompare(b.first_name, "ro"));
        }
      }

      if (users.length === 0) {
        toast.warning("Nu s-au găsit utilizatori.");
        return;
      }

      await generateUserListPDF(users, getTitle());
      toast.success(`PDF generat cu ${users.length} utilizatori.`);
    } catch (err: any) {
      toast.error(err.message || "Eroare la generare");
    } finally {
      setLoadingList(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold">Generare credențiale PDF</h1>
        <p className="text-sm text-muted-foreground">
          Resetează parolele și descarcă un PDF cu credențialele de acces.
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 md:gap-6 sm:grid-cols-3">
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

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!canGenerate || loading || loadingList}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Resetează și generează PDF
            </Button>

            {mode !== "user" && (
              <Button
                onClick={handleGenerateUserList}
                disabled={!canGenerate || loading || loadingList}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {loadingList ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Generează PDF utilizatori
              </Button>
            )}
          </div>
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
