

# Plan: Participanți anonimi in rapoarte si lista de prezenta coordonator

Acest plan extinde planul aprobat anterior pentru evenimente publice, adaugand integrarea participantilor anonimi (din `public_reservations` / `public_tickets`) in:
1. Rapoartele admin si diriginte
2. Lista de prezenta a coordonatorului (EventParticipantsPage + ScanPage)

## Presupuneri

Tabelele `public_reservations` si `public_tickets` vor fi create conform planului anterior, cu structura:
- `public_reservations`: `id, event_id, guest_name, guest_email, reservation_code, status, created_at`
- `public_tickets`: `id, public_reservation_id, attendee_name, qr_code_data, status, checkin_timestamp, created_at`

## 1. RLS Policies (migratie SQL)

- **Coordonatorii** pot citi `public_reservations` si `public_tickets` pentru evenimentele lor (join pe `coordinator_assignments`)
- **Coordonatorii** pot actualiza `public_tickets.status` pentru evenimentele lor
- **Admin** full access pe ambele tabele
- **Anon** insert + select by `reservation_code` (deja planificat)

## 2. EventParticipantsPage (coordonator)

**Fișier**: `src/pages/coordinator/EventParticipantsPage.tsx`

Modificari:
- Al doilea query care incarca `public_reservations` + `public_tickets` pentru acelasi `eventId`
- Concateneaza participantii normali cu cei anonimi intr-o lista unificata
- Participantii anonimi apar cu un badge "Vizitator" si numele din `public_tickets.attendee_name`
- Nu au `student_identifier` sau `profiles` — se afiseaza doar numele
- Butoanele de schimbare status functioneaza identic, dar update-ul se face pe `public_tickets` in loc de `tickets`
- Statisticile (total, prezenti, etc.) includ ambele tipuri
- Audit log: se va folosi `ticket_id = null` si un `notes` care specifica "public ticket" + id-ul public ticket-ului

## 3. ScanPage (coordonator)

**Fișier**: `src/pages/coordinator/ScanPage.tsx`

Modificari:
- `processTicket()`: daca nu gaseste QR in `tickets`, cauta si in `public_tickets`
- Daca gaseste in `public_tickets`, afiseaza numele participantului anonim si permite marcarea
- `markMutation`: detecteaza tipul de bilet si face update pe tabelul corect
- Tab-ul "Cauta elev": cauta si in `public_tickets` dupa `attendee_name`

## 4. Admin ReportsPage

**Fișier**: `src/pages/admin/ReportsPage.tsx`

### EventReport
- Query-ul incarca si `public_reservations` + `public_tickets` per eveniment
- Adauga la numarul de rezervari, prezenti, intarziati, absenti

### ClassReport
- Fara modificari (anonimi nu apartin unei clase)

### StudentReport
- Adauga un tab/sectiune separata "Vizitatori" sau un filtru "Fara clasa" care listeaza participantii anonimi agregat per eveniment

## 5. Teacher ReportsPage

**Fișier**: `src/pages/teacher/TeacherReportsPage.tsx`

- Fara modificari (dirigintii vad doar elevii din clasele lor)

## Fișiere modificate
- `src/pages/coordinator/EventParticipantsPage.tsx` — query + render anonimi
- `src/pages/coordinator/ScanPage.tsx` — scan + search in public_tickets
- `src/pages/admin/ReportsPage.tsx` — EventReport + StudentReport includ anonimi
- Migratie SQL — RLS policies pentru coordonatori pe tabelele publice

## Nota
Aceste modificari depind de crearea prealabila a tabelelor `public_reservations` si `public_tickets`. Implementarea se va face in aceeasi iteratie cu planul de evenimente publice.

