import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (!res.ok) { setState("invalid"); return; }
        if (data.valid === true) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  async function confirmUnsubscribe() {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (!res.ok) { setState("error"); return; }
      if (data.success) setState("success");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {state === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Se verifică linkul…</p>
            </>
          )}
          {state === "valid" && (
            <>
              <h1 className="text-2xl font-bold">Dezabonare</h1>
              <p className="text-muted-foreground">
                Confirmă că nu mai dorești să primești emailuri de la noi.
              </p>
              <Button onClick={confirmUnsubscribe} disabled={submitting} className="w-full">
                {submitting ? "Se procesează…" : "Confirmă dezabonarea"}
              </Button>
            </>
          )}
          {state === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
              <h1 className="text-2xl font-bold">Te-ai dezabonat</h1>
              <p className="text-muted-foreground">Nu vei mai primi emailuri de la noi.</p>
            </>
          )}
          {state === "already" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground" />
              <h1 className="text-2xl font-bold">Deja dezabonat</h1>
              <p className="text-muted-foreground">Această adresă este deja dezabonată.</p>
            </>
          )}
          {state === "invalid" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h1 className="text-2xl font-bold">Link invalid</h1>
              <p className="text-muted-foreground">Acest link de dezabonare nu mai este valid sau a expirat.</p>
            </>
          )}
          {state === "error" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h1 className="text-2xl font-bold">Eroare</h1>
              <p className="text-muted-foreground">A apărut o eroare. Încearcă din nou mai târziu.</p>
            </>
          )}
          <div className="pt-4">
            <Link to="/" className="text-sm text-muted-foreground hover:underline">
              Înapoi la pagina principală
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
