# Reparare acces la date după restaurarea backup-ului

## Ce s-a întâmplat

Datele sunt intacte: **1021 profiluri** și **1021 roluri** există în baza restaurată. Problema nu e pierdere de date, ci de **permisiuni**: restaurarea din backup a adus tabelele fără drepturile de acces (GRANT) pentru rolurile aplicației.

Verificat acum: niciunul dintre cele **60 de tabele** din schema publică nu mai are GRANT pentru `anon`, `authenticated` sau `service_role`. De aceea aplicația primește liste goale (0 utilizatori, probabil și 0 evenimente, clase etc.) — cererile sunt respinse înainte să ajungă la regulile de securitate pe rânduri.

Restul e în regulă: politicile RLS există, funcțiile de securitate au drepturi de execuție, schema `public` e accesibilă.

## Ce fac

O singură migrație care reface drepturile pierdute:

1. Pentru toate cele 60 de tabele publice: `SELECT, INSERT, UPDATE, DELETE` pentru `authenticated` și `ALL` pentru `service_role`.
2. Acces public (vizitatori nelogați), doar unde politicile o cer:
   - `events` — citire evenimente publice publicate
   - `public_reservations`, `public_tickets` — inserare rezervări fără cont
3. Restabilesc restricția de securitate pe email: `authenticated` primește drepturi pe toate coloanele din `profiles` **cu excepția** coloanei `email` (rămâne accesibilă doar prin funcția `get_profile_emails`, limitată la admin/manager). `anon` nu primește nimic pe `profiles`.

## Verificare după aplicare

- Confirm că lista de utilizatori din admin se încarcă din nou.
- Verific o pagină de elev și una publică (evenimente) ca să confirm că nu a rămas alt tabel blocat.
- Rulez linterul de securitate ca să mă asigur că nu am lărgit accesul nicăieri.

## Note

- Nu se pierd și nu se modifică date — doar drepturi de acces.
- După reparare poți relua Pasul 3 din planul anterior: promovarea claselor către 2026-2027, o singură dată.
