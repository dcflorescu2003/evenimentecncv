import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function DeleteAccountPage() {
  const { session, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    navigate("/login");
    return null;
  }

  const expectedText = "STERGE CONTUL";

  async function handleDelete() {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-own-account");

      if (error || !data?.success) {
        toast.error(data?.error || "Eroare la ștergerea contului.");
        setDeleting(false);
        return;
      }

      toast.success("Contul a fost șters cu succes.");
      await signOut();
      navigate("/login");
    } catch {
      toast.error("Eroare la ștergerea contului.");
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi
        </Button>

        <Card className="border-destructive/50">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl text-destructive">Ștergere cont</CardTitle>
            <CardDescription>
              Această acțiune este <strong>permanentă și ireversibilă</strong>. Toate datele tale vor fi șterse definitiv.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p><strong>Cont:</strong> {profile.display_name || `${profile.first_name} ${profile.last_name}`}</p>
                <p><strong>Utilizator:</strong> {profile.username}</p>
              </div>
            )}

            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <p className="font-medium mb-1">Se vor șterge:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Profilul și datele personale</li>
                <li>Toate rezervările și biletele</li>
                <li>Istoricul de prezență</li>
                <li>Formularele trimise</li>
                <li>Notificările</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">
                Scrie <strong>{expectedText}</strong> pentru confirmare
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder={expectedText}
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={confirmText !== expectedText || deleting}
                >
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Șterge contul definitiv
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ești absolut sigur?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Contul tău și toate datele asociate vor fi șterse permanent. Nu vei mai putea recupera aceste informații.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anulează</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Da, șterge contul
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <footer className="pb-6 text-center text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:underline">Politica de Confidențialitate</Link>
        </footer>
      </div>
    </div>
  );
}
