# Cluburi permanente, independente de sesiune

Cluburile nu vor mai fi legate de o sesiune de program. Odată create, rămân valabile permanent, indiferent de sesiunea activă sau de anul școlar.

## Ce se schimbă pentru utilizatori

- Se poate crea un club chiar dacă nu există nicio sesiune activă (dispare mesajul „Nu există o sesiune activă”).
- Cluburile create rămân vizibile și disponibile pentru înscriere după închiderea sesiunii, până când sunt trecute manual în „arhivat”.
- În Rapoarte, secțiunea Cluburi afișează toate cluburile, nu doar pe cele din sesiunea selectată.
- Proiectele de voluntariat rămân neschimbate, legate mai departe de sesiune.

## Ce rămâne la fel

- Regulile de înscriere (perioadă de înscriere, capacitate, clase/ani eligibili, limită per clasă) funcționează identic — verificarea nu folosea deja sesiunea.
- Prezența la întâlniri, coordonatorii și înscrierile existente rămân intacte.

## Detalii tehnice

1. Migrare bază de date:
   - `ALTER TABLE public.clubs ALTER COLUMN session_id DROP NOT NULL;`
   - Coloana se păstrează (fără ștergere de date) pentru cluburile existente; nu se mai completează la creare.
2. `src/components/clubs/ClubsVolunteerHub.tsx`:
   - Formularul de club nu mai primește/trimite `sessionId`; se elimină blocarea la lipsa sesiunii active.
   - Interogarea `active-session` rămâne doar pentru proiectele de voluntariat.
3. `src/pages/admin/ReportsPage.tsx` — `ClubsReport`: se elimină filtrul `.eq("session_id", sessionId)`, listând toate cluburile.
4. Fără modificări la politicile RLS sau la `check_club_enrollment` (nu depind de sesiune).
