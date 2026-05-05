
## Obiectiv

Permite adminului să adauge participanți la evenimentele publice direct din pagina evenimentului. Acești participanți:
- pot depăși `max_capacity` (nu sunt limitați)
- **NU** se contorizează în locurile ocupate afișate altor utilizatori (ex: pe pagina publică de booking, în „locuri disponibile")
- primesc bilete cu QR ca participanții publici normali
- pot fi anulați/scanați la fel ca rezervările publice

## Modificări

### 1. Bază de date (migrare)

Adăugare coloană în `public_reservations`:
```
ALTER TABLE public_reservations 
  ADD COLUMN added_by_admin uuid REFERENCES auth.users(id) DEFAULT NULL;
```
- `NULL` = rezervare publică normală (face parte din capacitate)
- `<uuid admin>` = adăugat manual de admin (nu intră în capacitate)

### 2. Funcția `get_events_reserved_counts` (RPC)

Modificare: la sub-query-ul pentru `public_tickets`, adaugă filtrul `pr.added_by_admin IS NULL` astfel încât rezervările făcute de admin să NU fie numărate la locurile ocupate.

### 3. Funcția `check_booking_eligibility`

În calculul `_public_count`, exclude rezervările cu `pr.added_by_admin IS NOT NULL`. Astfel, capacitatea rămasă pentru elevi nu este afectată de cei adăugați de admin.

### 4. UI Admin – `src/pages/admin/EventDetailPage.tsx`

În tab-ul „Participanți", când `event.is_public === true`, adaugă un buton nou:
- **„Adaugă participant extern"** (lângă „Adaugă elev")

La click, deschide un dialog cu:
- Nume (obligatoriu)
- Email (opțional)
- Telefon (opțional)
- Listă dinamică de participanți (1+ nume), similar cu formularul public

La submit:
- Insert direct în `public_reservations` cu `added_by_admin = auth.uid()`, `status='reserved'`
- Insert în `public_tickets` câte unul pentru fiecare nume (status='reserved')
- Log în `audit_logs` (`action='admin_public_enrollment'`)
- Invalidate query-uri pentru re-render
- Toast de succes care menționează „peste capacitate, nu ocupă locuri"

În tabelul deja existent din tab-ul „Contact" și în lista de participanți publici din tab-ul „Participanți", afișează un mic badge **„Adăugat de admin"** pentru rezervările cu `added_by_admin != null`, ca să fie vizual diferențiate.

### 5. Edge function `public-book-event`

Niciun impact (rezervările publice obișnuite continuă să verifice capacitatea normală bazată pe `get_events_reserved_counts`, care acum exclude pe cei adăugați de admin → comportament corect).

## Note tehnice

- RLS pe `public_reservations`/`public_tickets` deja permite adminului să facă INSERT/SELECT (politica „Admins manage…").
- Tipurile TypeScript din `src/integrations/supabase/types.ts` se regenerează automat după migrare.
- Nu se trimite email de confirmare pentru participanții adăugați de admin (fluxul nu trece prin edge function-ul de booking public). Dacă e necesar email mai târziu, se poate adăuga separat.
