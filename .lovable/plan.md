# Reducerea consumului de credite (Lovable Cloud)

## Ce am constatat

Din consumul lunii curente (163 credite), partea de Cloud înseamnă:

- Instanță „medium” (calcul): 35 credite — de departe cel mai mare cost
- Instanțe mai mici (istoric): 8,7 credite
- Trafic de date: 1,7 credite
- Funcții, stocare, realtime: sub 0,3 credite (neglijabil)

Deci economia reală vine din dimensiunea instanței și din spațiul ocupat, nu din cod.

Două lucruri ies în evidență:

1. **Instanța e supradimensionată.** Memorie folosită 38%, conexiuni 13 din 60, pool 1 din 200, zero reporniri. Aplicația nu are nevoie de „medium”.
2. **3,6 GB din cei 3,57 GB ai bazei sunt un jurnal inutil.** Tabelul intern de istoric al sarcinilor programate are 1,12 milioane de rânduri, din care 1,11 milioane provin de la o sarcină ștearsă între martie și iulie (rula la câteva secunde). Toate datele reale ale aplicației însumează sub 15 MB. Acest jurnal ocupă ~49% din disc și încetinește întreținerea bazei.

## Ce propun (în această ordine, fără risc pentru aplicație)

### 1. Curățarea jurnalului de sarcini programate
Ștergem istoricul mai vechi de 7 zile din jurnalul intern și eliberăm spațiul. Nu conține date ale aplicației — doar urme de execuție. Baza scade de la ~3,6 GB la sub 50 MB.

### 2. Păstrare automată a jurnalului
Adăugăm o sarcină zilnică scurtă care șterge înregistrările mai vechi de 7 zile, ca problema să nu reapară.

### 3. Micșorarea instanței (medium → small)
După curățare, cer aprobarea ta printr-un card de redimensionare. Reduce costul de calcul cu aproximativ 60%. Dacă vreodată aplicația devine lentă în perioade aglomerate, se poate mări înapoi în câteva minute, fără pierderi de date.

### 4. Reducerea traficului inutil (opțional, mic câștig)
- Clopoțelul de notificări interoghează serverul la fiecare 60 de secunde în fiecare filă deschisă; îl trecem la 3 minute și oprim interogarea când fila nu e vizibilă.
- Câteva pagini de administrare descarcă toate coloanele (`select *`) din tabele mari (utilizatori, clase, rapoarte); le limităm la coloanele efectiv afișate.

Nu modific nimic din logica Smart Lab, cluburi, voluntariat, prezență sau legitimație.

## Detalii tehnice

- `DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'` în loturi, apoi `VACUUM FULL` pe tabel (sau `pg_repack`-like în loturi, pentru a nu bloca).
- Sarcină nouă `cron.schedule('purge-cron-history','15 4 * * *', ...)` cu același DELETE.
- Redimensionare prin `resize_compute` (medium → small) — necesită aprobarea ta în chat.
- Frontend: `NotificationBell.tsx` — `refetchInterval: 180000` + `refetchIntervalInBackground: false`; înlocuirea `select("*")` cu liste explicite de coloane în `UsersPage.tsx`, `ClassesPage.tsx`, `AuditPage.tsx`, `ReportsPage.tsx`.

## Ce NU propun

- Nu ștergem date ale aplicației (elevi, evenimente, prezențe, rezervări).
- Nu atingem funcțiile edge sau notificările push — costă sub 0,3 credite pe lună.
- Costul mesajelor din chat (117 credite) nu ține de Cloud; se reduce doar prin cereri mai grupate.
