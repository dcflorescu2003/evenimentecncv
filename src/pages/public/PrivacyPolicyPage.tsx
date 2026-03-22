import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" /> Înapoi
        </Button>

        <h1 className="font-display text-3xl font-bold mb-2">Politica de Confidențialitate</h1>
        <p className="text-sm text-muted-foreground mb-8">Ultima actualizare: 22 martie 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Introducere</h2>
            <p className="text-muted-foreground leading-relaxed">
              Colegiul Național „Cantemir Vodă" București (CNCV) respectă confidențialitatea datelor dumneavoastră personale.
              Această politică descrie modul în care colectăm, utilizăm și protejăm informațiile prin intermediul platformei
              de gestionare a evenimentelor și prezenței.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Date colectate</h2>
            <p className="text-muted-foreground leading-relaxed">Colectăm următoarele categorii de date personale:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Nume, prenume și adresă de e-mail</li>
              <li>Număr de telefon (opțional, pentru rezervări publice)</li>
              <li>Identificator elev (pentru conturile de elev)</li>
              <li>Informații despre prezență la evenimente (check-in, ora sosirii)</li>
              <li>Date tehnice: adresă IP, tip browser, date de autentificare</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Scopul prelucrării</h2>
            <p className="text-muted-foreground leading-relaxed">Datele sunt prelucrate exclusiv pentru:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Gestionarea conturilor utilizatorilor (elevi, profesori, coordonatori)</li>
              <li>Organizarea și administrarea evenimentelor școlare</li>
              <li>Înregistrarea și monitorizarea prezenței la evenimente</li>
              <li>Generarea rapoartelor statistice privind participarea</li>
              <li>Emiterea și validarea biletelor/rezervărilor pentru evenimente publice</li>
              <li>Trimiterea notificărilor legate de evenimente</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Temeiul legal</h2>
            <p className="text-muted-foreground leading-relaxed">
              Prelucrarea datelor se realizează în baza interesului legitim al instituției de învățământ pentru
              organizarea activităților educative, precum și în baza consimțământului dumneavoastră pentru
              rezervările la evenimentele publice, conform Regulamentului General privind Protecția Datelor (GDPR).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Stocarea și securitatea datelor</h2>
            <p className="text-muted-foreground leading-relaxed">
              Datele sunt stocate pe servere securizate cu criptare în tranzit și în repaus. Accesul la date
              este restricționat prin roluri și politici de securitate la nivel de rând (RLS). Păstrăm datele
              pe durata anului școlar curent și le arhivăm conform reglementărilor aplicabile.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Drepturile dumneavoastră</h2>
            <p className="text-muted-foreground leading-relaxed">Conform GDPR, aveți dreptul la:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li><strong>Acces</strong> — să solicitați o copie a datelor personale</li>
              <li><strong>Rectificare</strong> — să corectați datele inexacte</li>
              <li><strong>Ștergere</strong> — să solicitați ștergerea datelor, în condițiile legii</li>
              <li><strong>Restricționare</strong> — să limitați prelucrarea în anumite situații</li>
              <li><strong>Portabilitate</strong> — să primiți datele într-un format structurat</li>
              <li><strong>Opoziție</strong> — să vă opuneți prelucrării în anumite cazuri</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Cookie-uri</h2>
            <p className="text-muted-foreground leading-relaxed">
              Platforma utilizează cookie-uri esențiale pentru autentificare și menținerea sesiunii.
              Nu folosim cookie-uri de marketing sau de urmărire. Cookie-urile de sesiune sunt șterse
              automat la deconectare sau la expirarea sesiunii.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pentru orice întrebări sau solicitări privind datele dumneavoastră personale, ne puteți contacta la:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Colegiul Național „Cantemir Vodă" București</strong><br />
              E-mail: <a href="mailto:lcantemirvoda@yahoo.com" className="text-primary hover:underline">lcantemirvoda@yahoo.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
