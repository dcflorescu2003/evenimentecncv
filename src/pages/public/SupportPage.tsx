import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, HelpCircle, Wrench, KeyRound, Trash2, Shield } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

export default function SupportPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" /> Înapoi
        </Button>

        <h1 className="font-display text-3xl font-bold mb-2">Suport și asistență</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Aici găsești răspunsuri la întrebările frecvente și modalități de a ne contacta.
        </p>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Contact
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Pentru orice întrebare, problemă tehnică sau solicitare legată de cont, ne puteți contacta:
            </p>
            <div className="mt-3 rounded-lg border bg-card p-4">
              <p className="font-semibold">Colegiul Național „Cantemir Vodă" București</p>
              <p className="text-sm text-muted-foreground mt-1">
                E-mail:{" "}
                <a href="mailto:lcantemirvoda@yahoo.com" className="text-primary hover:underline">
                  lcantemirvoda@yahoo.com
                </a>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Răspundem de obicei în 1–3 zile lucrătoare.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" /> Întrebări frecvente
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Cum mă autentific?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Folosește numele de utilizator (ex: <code className="text-xs bg-muted px-1 rounded">e.ion.popescu</code>) și parola primite de la administrator sau diriginte.
                  La prima autentificare vei fi rugat să schimbi parola.
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Cum îmi schimb parola?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  După autentificare, accesează meniul contului și alege „Schimbă parola".
                  Dacă ai uitat parola, contactează administratorul sau dirigintele pentru resetare.
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Cum rezerv un loc la un eveniment?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Din pagina „Evenimente" alege evenimentul dorit, apasă „Rezervă" și confirmă.
                  Biletul tău cu cod QR apare imediat în secțiunea „Biletele mele".
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Cum se face check-in-ul la eveniment?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  La intrare, prezintă biletul cu codul QR din contul tău. Profesorul coordonator
                  îl scanează cu camera dispozitivului. Sosirile sunt acceptate cu 30 de minute înainte
                  și până la 15 minute după ora de start.
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Pot anula o rezervare?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Da, din secțiunea „Biletele mele" poți anula o rezervare activă. Locul devine
                  imediat disponibil pentru alți elevi.
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Cum îmi șterg contul?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Accesează pagina <Link to="/delete-account" className="text-primary hover:underline">Ștergere cont</Link>{" "}
                  și urmează pașii. Ștergerea este definitivă și include toate datele asociate.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" /> Probleme tehnice
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Dacă întâmpini o problemă cu aplicația, încearcă pașii de mai jos:
            </p>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-1 mt-2 text-sm">
              <li>Reîncarcă aplicația (închide și redeschide).</li>
              <li>Verifică conexiunea la internet.</li>
              <li>Deconectează-te și autentifică-te din nou.</li>
              <li>Asigură-te că ai cea mai recentă versiune a aplicației.</li>
              <li>Dacă problema persistă, trimite-ne un e-mail cu o descriere și o captură de ecran.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Resetare parolă
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Resetarea parolei se face de către administrator sau de către dirigintele clasei.
              Trimite o solicitare prin e-mail cu numele complet și clasa, iar o nouă parolă temporară
              îți va fi comunicată. La prima autentificare vei fi rugat să o schimbi.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-primary" /> Ștergere cont
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Poți solicita ștergerea definitivă a contului din pagina dedicată:
            </p>
            <Link to="/delete-account" className="inline-block mt-2 text-primary hover:underline">
              Mergi la pagina de ștergere cont →
            </Link>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Politica de confidențialitate
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Pentru detalii despre modul în care colectăm și protejăm datele tale, consultă:
            </p>
            <Link to="/privacy" className="inline-block mt-2 text-primary hover:underline">
              Politica de Confidențialitate →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
