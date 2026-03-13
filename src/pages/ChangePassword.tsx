import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import cncvLogo from "@/assets/cncv-logo.jpg";

export default function ChangePassword() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Parola trebuie să aibă minim 8 caractere.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Parolele nu coincid.");
      return;
    }

    if (newPassword === "Cncv1234#") {
      setError("Alegeți o parolă diferită de cea implicită.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      // Mark password as changed
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false } as any)
        .eq("id", user!.id);
      if (profileError) throw profileError;

      // Force re-fetch profile
      window.location.href = "/login";
    } catch (err: any) {
      setError(err.message || "Eroare la schimbarea parolei.");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-3">
          <img src={cncvLogo} alt="Logo CNCV" className="mx-auto h-16 w-16 object-contain" />
          <CardTitle className="font-display text-xl">Schimbare parolă obligatorie</CardTitle>
          <CardDescription>
            Bine ai venit, {profile?.first_name}! Trebuie să îți setezi o parolă nouă la prima autentificare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Parolă nouă</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Minim 8 caractere"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmă parola</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repetă parola nouă"
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvează parola nouă
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={signOut}>
              Deconectare
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
