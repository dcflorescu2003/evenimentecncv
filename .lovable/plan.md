# Sign in with Apple — scope limitat (vizitator + manager)

## Context

Aplicația folosește login intern (`username@school.local` + parolă, conturi create de admin). Elevii / profesorii NU vor folosi Apple Sign In. Apple cere SIWA doar dacă există alt social login (Google/Facebook) — momentan nu e cazul, deci adăugarea e **preventivă** pentru a evita o respingere și a oferi reviewer-ului un flux rapid.

## Strategie

Adăugăm un buton "Sign in with Apple" pe pagina de login și pe pagina publică de evenimente. Fluxul de după autentificare e decis pe baza unei mici tabele de mapare:

- Dacă emailul Apple există în `apple_account_links` → utilizatorul primește automat rolul mapat (ex: `manager`) și e redirectat la dashboard-ul corespunzător.
- Dacă nu → utilizatorul e tratat ca **vizitator**: redirect la `/public/events`, fără rol intern, fără acces la zonele de elev/profesor.

Asta înseamnă:

- Reviewer-ul Apple → tap pe "Sign in with Apple" → vede catalogul public (suficient pentru aprobare 4.8).
- Tu îi asociezi în prealabil emailul Apple al managerului → managerul, la primul Apple Sign In, intră direct cu rol manager.
- Niciun cont elev/profesor nu poate fi accesat via Apple — securitate păstrată.

## Pași implementare

### 1. Activare provider

Folosim Lovable Cloud managed Apple Sign In (fără Apple Developer credentials la început — managed e suficient pentru testare; pentru branding propriu se poate trece la BYOC ulterior).

### 2. Migrație DB

Tabelă nouă `apple_account_links`:

- `apple_email` (text, unique, lowercased)
- `target_role` (`app_role`) — rolul acordat (`manager` în cazul nostru)
- `notes` (text, opțional — ex. "App Review demo")
- `created_by`, `created_at`

RLS: doar admin poate citi/scrie. RPC `link_apple_user_to_role(_user_id uuid, _email text)` (security definer) care:

1. caută în `apple_account_links` după email
2. dacă găsește → inserează rolul în `user_roles` pentru `_user_id` (idempotent), creează un `profiles` minimal dacă nu există
3. returnează rolul găsit sau `null` (vizitator)

### 3. UI

- `**Login.tsx**`: buton "Sign in with Apple" sub formularul existent, separat printr-un divider "sau".
- `**PublicEventsPage.tsx**` (sau un loc vizibil pe `/public/events`): buton "Sign in with Apple" pentru vizitatori care vor să-și păstreze biletele între dispozitive (opțional — minim viabil e doar pe Login).
- Apel: `lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin })`.

### 4. Post-login routing

În `useAuth` / `Login` (sau o pagină dedicată `/auth/apple-callback`):

- după ce sesiunea Apple e disponibilă, apelează `link_apple_user_to_role(user.id, user.email)`.
- citește rezultatul:
  - `manager` → redirect `/manager`
  - altceva (null / vizitator) → redirect `/public/events`
- blochează explicit fluxurile `student` / `teacher` / `homeroom_teacher` pentru utilizatorii Apple care nu au mapping (chiar dacă cumva ar avea username-ul same, nu primesc rolul).

### 5. Admin UI (mică)

În `UsersPage` (sau o secțiune nouă în Cloud) — un mic dialog "Asociază email Apple cu rol":

- input email + select rol (default `manager`).
- listă cu maparea curentă, cu buton ștergere.
- Pentru App Review: tu adaugi emailul Apple al reviewerului (dacă vrei să intre direct ca manager) sau îl lași gol (intră ca vizitator).

### 6. Capacitor / iOS

Pentru `signInWithApple` pe iOS native, în Capacitor merge prin redirect web (acceptat de Apple). Nu e nevoie de plugin nativ separat dacă folosim Lovable Cloud OAuth broker. Verificăm că `/~oauth` e exclus din service worker (deja e, conform regulilor proiectului PWA).

### 7. App Store Connect

- Adaugă "Sign in with Apple" în lista de auth methods.
- Demo account pentru reviewer: emailul Apple al reviewerului + nota "Sign in with Apple → vei vedea evenimente publice; pentru cont demo de elev folosește elev.test / Elev123!".

## Idei alternative / consideratii

1. **Nu adăuga deloc Apple Sign In.** Riscul real de respingere pe 4.8 e mic — nu există alt OAuth în app. Costul: dacă te resping, pierzi ~1 săptămână. Dacă vrei minim risk, săriți peste pasul ăsta.
2. **Doar pe pagina publică** (nu pe Login intern). Mai curat semantic — Apple Sign In e exclusiv pentru "guest checkout" la evenimente publice. Managerul rămâne pe username/parolă. Mai puțină complexitate, dar pierzi "fluxul demo manager prin Apple".
3. **BYOC Apple credentials** mai târziu — pentru branding ("Sign in to Cantemir Vodă" în loc de "to Lovable"). Necesită Apple Developer Program (ai deja, dacă publici pe App Store) + .p8 key. Recomand să rămânem pe managed la prima submisie și să trecem ulterior dacă vrei branding propriu.

## Tehnic — fișiere afectate

- `supabase/migrations/...` — tabela `apple_account_links` + RPC `link_apple_user_to_role` + RLS.
- `src/integrations/lovable/...` — generat automat de tool-ul de Configure Social Auth.
- `src/pages/Login.tsx` — buton Apple.
- `src/pages/public/PublicEventsPage.tsx` — buton Apple (opțional).
- `src/hooks/useAuth.tsx` — la primirea sesiunii cu provider `apple`, apelează RPC-ul de mapare înainte de a popula rolurile.
- `src/pages/admin/UsersPage.tsx` (sau pagină nouă `AppleLinksPage.tsx`) — UI pentru asociere email→rol.
- `APPSTORE_SUBMISSION.md` — actualizare secțiunea demo + add Sign in with Apple în descriere.

## Întrebare deschisă

Vrei să adaug butonul Apple **și** pe pagina publică de evenimente (nu doar pe Login)? Răspunsul nu blochează planul — implementăm minim pe Login și extindem ușor dacă vrei.  
  
Amanam planul pana dupa review