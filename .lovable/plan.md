## Obiectiv

Extind pagina **Admin → Rapoarte** (`src/pages/admin/ReportsPage.tsx`) cu trei taburi noi, fiecare cu rapoarte dedicate, separate de cele existente (Pe clasă / Pe eveniment / Pe elev).

Toate rapoartele se filtrează după **sesiunea selectată** (selectorul existent din header) și au buton **Export PDF** + tabel + grafic acolo unde aduce valoare. Folosesc aceleași patternuri (batch fetch >1000 rânduri, `exportReportPdf`, `ChartContainer`).

## Tab "Feedback"

Listează toate chestionarele din sesiune cu metrici de participare. Surse: `feedback_forms`, `feedback_responses`, `feedback_questions`.

Coloane tabel:
- Titlu chestionar
- Tip (General / Feedback profesori / etc.)
- Audiență (Elevi / Profesori)
- Status (Draft / Activ / Închis)
- Anonimitate
- Nr. întrebări
- Nr. răspunsuri totale
- Nr. respondenți identificați
- Data deschidere / închidere
- Acțiune: link "Vezi raport" → `/admin/feedback/:id/report` (există deja)

Card sumar deasupra: total chestionare, total răspunsuri în sesiune, top 3 chestionare după nr. răspunsuri (bar chart).

## Tab "Cluburi"

Listează cluburile din sesiune. Surse: `clubs`, `club_enrollments`, `club_meetings`, `club_attendance`.

Coloane tabel:
- Nume club
- Status (Draft / Activ / Închis)
- Înscriși activi (status=`enrolled`)
- Capacitate / % ocupare
- Nr. întâlniri programate
- Nr. întâlniri ținute (cele cu cel puțin un `club_attendance.status='present'`)
- Rată prezență medie (% present din total marcate pe toate întâlnirile)

Card sumar: total cluburi active, total elevi înscriși (distinct), total întâlniri ținute, bar chart "Înscriși per club" (top 10).

Export PDF: tabel complet (landscape).

## Tab "Voluntariat"

Listează proiectele de voluntariat din sesiune. Surse: `volunteer_projects`, `volunteer_enrollments`, `volunteer_days`, `volunteer_attendance`.

Coloane tabel:
- Nume proiect
- Status (Draft / Activ / Închis)
- Înscriși activi
- Capacitate / % ocupare
- Nr. zile programate
- Total ore validate (sumă ore din `volunteer_attendance` cu status `present`)
- Nr. voluntari care au cel puțin o prezență

Card sumar: total proiecte active, total voluntari unici, total ore validate în sesiune, bar chart "Ore validate per proiect" (top 10).

Export PDF: tabel complet (landscape).

## Detalii tehnice

- Adaug 3 `<TabsTrigger>` noi în `TabsList` din `ReportsPage.tsx`, după "students": `feedback`, `clubs`, `volunteers`.
- Adaug 3 componente noi în același fișier: `FeedbackReport`, `ClubsReport`, `VolunteersReport`, fiecare primește `sessionId`.
- Pentru fiecare folosesc `useQuery` cu key `["report-feedback"|"report-clubs"|"report-volunteers", sessionId]`.
- Pentru queries >1000 rânduri (`club_attendance`, `volunteer_attendance`) folosesc helper-ul `batchFetch` deja prezent în fișier (îl extrag într-o funcție utility la nivel de modul ca să nu-l duplic).
- Numele cluburilor/proiectelor/chestionarelor sunt deja în tabele — fără join cu profiles necesar.
- Pentru "rată prezență club" și "ore voluntariat" calculele se fac client-side după fetch.
- Texte UI 100% în română, format dată `zz.ll.aaaa` via `formatDate`.
- Fără modificări de schemă, RLS sau edge functions (adminul are deja `ALL` pe toate aceste tabele).

## Out of scope

- Drill-down per club/proiect (există deja paginile de detaliu).
- Modificări la `/admin/feedback` list page (rămâne cum e).
- Schimbări de navigație în sidebar.
