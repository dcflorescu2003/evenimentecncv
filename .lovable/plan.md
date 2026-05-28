# Fix raport feedback

## Diagnostic
- Răspunsurile **se înregistrează corect** (14 răspunsuri + 42 răspunsuri la întrebări în DB pentru formularul „Test Bun").
- Cauza pentru „nu apare nimic la rapoarte": în `FeedbackReportPage.tsx` interogarea folosește embed PostgREST:
  ```ts
  .select("..., profiles:respondent_id (first_name, last_name)")
  ```
  Dar pe `feedback_responses.respondent_id` **nu există FK către `profiles`**, deci PostgREST returnează eroare „Could not find a relationship…" și query-ul eșuează → 0 răspunsuri afișate → nimic în rapoarte.

## Soluție
1. În `src/pages/feedback/FeedbackReportPage.tsx`, elimin embed-ul `profiles:respondent_id (...)` din `select`.
2. După ce primesc răspunsurile, colectez `respondent_id`-urile non-null (din răspunsurile identificate) și fac un al doilea query către `profiles` cu `.in("id", ids)` pentru a obține `first_name, last_name`.
3. Mapez numele înapoi pe `respondent_name` (păstrând logica „Anonim" pentru `is_identified=false`).

Nicio altă schimbare — agregările, exportul PDF și lista individuală rămân identice. Submission flow nu se atinge (funcționează deja).

## Detalii tehnice
- Pattern consistent cu restul proiectului (evităm join-uri implicite când nu există FK declarat).
- Nu adăugăm FK acum (toate răspunsurile existente sunt anonime, nu blochează nimic).
