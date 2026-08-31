# Recuperare după dubla promovare a claselor

## Situația actuală (confirmată din baza de date)

- Două execuții `promote_classes` în audit: 20:03 și 20:05, ambele către anul 2026-2027.
- Elevi șterși: 241 + 226 = **467** (din 946 au rămas 479).
- Clasele arată ca după o singură promovare (V, VI, VII, VIII fără secțiune + IX–XII A–G), dar elevii din clasele ajunse la VIII și XII după prima promovare au fost șterși la a doua rulare.

## Despre snapshot

- Nu există un snapshot accesibil din partea mea. Lovable Cloud nu oferă restore point-in-time self-serve, iar eu pot doar citi starea curentă.
- **Opțiune externă:** deschide un ticket la suportul Lovable și cere restaurarea din backup-ul zilnic (Supabase păstrează backup-uri automate; doar suportul poate decide dacă se poate face restore). Menționează timestamp-urile: cele două rulări au fost pe 31.08.2026, 20:03 și 20:05 UTC. Atenție: un restore ar aduce întreaga bază la starea de dinainte, deci s-ar pierde orice modificare făcută după backup.

## Plan de recuperare manuală (dacă nu alegi restore prin suport)

### Pasul 1 — Repararea claselor (revers o promovare)

Migrație SQL care inversează o promovare:

- IX–XII (A–G) → VIII–XI... atenție: starea corectă după o singură promovare este cea dorită (2026-2027), deci **clasele sunt de fapt OK acum**. Nu e nevoie de revers pe clase — problema sunt elevii șterși.
- Verific împreună cu tine dacă vrei ca anul curent să fie 2026-2027 (o promovare) sau 2025-2026 (zero promovări — atunci facem revers complet al claselor).

### Pasul 2 — Recuperarea elevilor șterși

Conturile șterse (inclusiv din auth) nu pot fi restaurate de mine. Opțiuni:

- **Reimport din CSV** prin funcția existentă `admin-import-csv` (aceeași procedură ca la importul inițial). Ai nevoie de fișierul CSV cu elevii. Parolele se resetează la cea implicită; istoricul (prezențe, rezervări, bilete) al elevilor șterși este pierdut definitiv fără restore din backup.
- Dacă ai CSV-ul doar pentru o parte din elevi, reimportăm selectiv.

### Pasul 3 — Prevenire pe viitor

- Adaug o protecție în `admin-promote-classes`: refuză rularea dacă în `audit_logs` există deja o promovare către același `new_academic_year`.

## Detalii tehnice

- Surse de adevăr consultate: `audit_logs` (2 înregistrări `promote_classes`), `classes`, `user_roles`, `student_class_assignments`.
- Funcția de ștergere elevi șterge în cascadă: rezervări, bilete, prezențe, form_submissions, notificări, roluri, profil și contul de auth — niciuna recuperabilă fără backup.  
  
Fa revers o promovare. Elevii de a XI-a sa ajung a X-a cu tot cu diriginti si voi importa eu elevii stersi