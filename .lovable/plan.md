# Restaurare backup + refacere promovare (o singură dată)

## Context

- Backup ales: **31.08.2026, 01:14 UTC** — stare curată: 946 elevi, clasele pe 2025-2026, înainte de cele două promovări accidentale (20:03 și 20:05 UTC).
- Restaurarea o faci tu din interfața Cloud (Database → Backups → „Restore to this backup"). Eu nu pot declanșa restaurarea.

## Pași

### Pasul 1 — Restaurarea (o faci tu din interfață)

- Apeși „Restore to this backup" pe backup-ul din 31.08.2026, 01:14 AM UTC și confirmi.
- Baza de date va fi indisponibilă câteva minute în timpul restaurării.
- Se pierd definitiv toate datele create/modificate după 01:14 UTC (inclusiv reversul manual de clase făcut de mine — nu mai e necesar).

### Pasul 2 — Verificare după restaurare (eu)

După ce confirmi că restaurarea s-a terminat:

- Verific starea backend-ului (cloud_status) până revine la ACTIVE_HEALTHY.
- Verific numărul de elevi (trebuie să fie ~946) și starea claselor (2025-2026).
- Verific dacă schema restaurată are neconcordanțe față de codul aplicației (migrații aplicate după 01:14) și re-aplic ce lipsește, dacă e cazul.

### Pasul 3 — Promovarea corectă, o singură dată

- Rulezi promovarea claselor din interfața de admin către 2026-2027.
- Protecția anti-dublă-rulare din `admin-promote-classes` (refuză a doua rulare către același an) rămâne activă — funcțiile edge nu sunt afectate de restaurarea bazei.
- Notă: protecția se bazează pe `audit_logs`, care revine la starea din 01:14 — deci nu va bloca prima rulare legitimă.

### Pasul 4 — Verificare finală (eu)

- Confirm clasele: V–VIII fără secțiune + IX–XII A–G pe 2026-2027.
- Confirm că elevii de VIII și XII (absolvenți) au fost eliminați o singură dată.
- Confirm că asignările elevilor s-au mutat corect odată cu clasele.

## Riscuri

- Datele create de utilizatori pe 31.08 după 01:14 UTC se pierd irecuperabil (rezervări, prezențe, teme etc.).
- Dacă aplicația prezintă erori de schemă după restore, le repar în Pasul 2.
