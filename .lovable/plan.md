# Rapoarte cu date complete

## Problema
Rapoartele citesc rezervările, biletele și elevii claselor dintr-o singură cerere. Serverul întoarce maxim 1000 de rânduri pe cerere, iar listele lungi de ID-uri pot eșua. Cu ~1000 de elevi, multe rezervări nu ajung în raport — de aceea „Atelier de sculptat dovleci” apare cu 0 înscriși, deși are 11.

## Ce reparăm
Toate citirile din rapoarte vor fi făcute în bucăți (ca la „Normă incompletă” și raportul pe profesori, deja reparate):

- Manager: Raport pe clase, pe zi, pe sesiune, pe eveniment, pe elev, ISMB, Dashboard.
- Profesor/diriginte: rapoartele clasei (sumar, matrice, evenimente fără participanți, detalii) și Dashboard.
- Admin: pagina de rapoarte.

## Verificare
- Comparăm în baza de date numărul real de înscriși pe evenimentele din X B cu ce afișează raportul pe clase (dovleci = 11).
- Verificăm vizual raportul pe clase din contul de manager.

## Detalii tehnice
- Se folosește helperul existent `fetchInChunks` (`src/lib/supabase-chunk.ts`): ID-uri în bucăți de ~200, fiecare paginat cu `.range()` la 1000.
- Fișiere: `src/pages/manager/{ClassReportPage,DayReportPage,SessionReportPage,EventReportPage,StudentReportPage,ISMBReportPage,ManagerDashboard}.tsx`, `src/pages/teacher/{TeacherReportsPage,TeacherDashboard}.tsx`, `src/pages/admin/AdminReportsPage.tsx`.
- Se elimină și citirea neflitrată `tickets` (toate biletele) din TeacherReportsPage.
- Fără schimbări în baza de date. Logica rapoartelor (plafon 4h/zi, eligibilitate pe clase) rămâne neschimbată.
