# Cartonaș „Actualizare disponibilă" pentru versiuni vechi

## Ce construim

Un cartonaș discret afișat în aplicație (hub-ul `/app`) când versiunea instalată e mai veche decât versiunea minimă acceptată, cu buton care deschide direct pagina aplicației în magazin (Play Store / App Store).

## Conformitate cu regulile magazinelor

- **Nu încalcă nicio regulă.** Google Play și Apple App Store permit explicit mesaje de tip „actualizați aplicația" în interiorul aplicației.
- Singura interdicție: descărcarea/instalarea de actualizări în afara magazinului. Noi doar deschidem pagina oficială din magazin — perfect legal.
- Cartonașul va fi **dismissibil** (poate fi închis), deci nu blocăm utilizatorul — asta evită orice risc de respingere la review.

## Componente

1. **Tabel `app_versions`** în baza de date:
   - `platform` (android / ios / web), `min_version`, `latest_version`, `store_url`
   - RLS: citire publică (oricine autentificat poate verifica versiunea), scriere doar admin.
   - Rânduri inițiale: android + ios cu versiunea curentă 1.28.

2. **Logica de comparație** (`src/lib/app-version.ts`):
   - Citește versiunea instalată: pe mobil prin Capacitor App plugin (`App.getInfo()`), pe web din `package.json`.
   - Compară semantic (1.27 < 1.28) cu versiunea minimă din baza de date.
   - Cache local ca să nu interogheze baza la fiecare afișare.

3. **Cartonașul** (`src/components/UpdateAvailableCard.tsx`):
   - Afișat în hub-ul `/app`, deasupra modulelor.
   - Text în română: „O versiune nouă a aplicației este disponibilă. Actualizează pentru cele mai recente îmbunătățiri."
   - Buton „Actualizează" → deschide URL-ul magazinului (Play Store pe Android, App Store pe iOS).
   - Buton „×" de închidere; preferința se memorează local până la următoarea versiune.
   - Pe web nu se afișează (web-ul e mereu la zi prin deploy).

4. **Administrare**: adminul poate actualiza `min_version`/`latest_version` direct în baza de date când publică o versiune nouă (fără ecran dedicat în această etapă).

## Detalii tehnice

- Migrare SQL: `CREATE TABLE public.app_versions` + GRANT SELECT authenticated/anon + RLS + rânduri seed (android/ios, 1.28).
- Capacitor `@capacitor/app` pentru `App.getInfo()` (deja disponibil în proiect — verific la implementare; dacă lipsește, îl adăug).
- Store URL-uri: Play Store `https://play.google.com/store/apps/details?id=com.evenimentecncv.app`; App Store — linkul final se completează când aplicația e publicată (până atunci fallback către căutare în App Store).
- Build + typecheck la final; fără modificări la fluxurile existente.

## Verificare

- Simulare: setez `min_version` mai mare decât versiunea curentă → cartonașul apare; setez înapoi → dispare.
- Build OK, typecheck OK.
