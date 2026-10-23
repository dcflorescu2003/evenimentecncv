# Raport sesiune — absențe pe zile lucrătoare (admin)

## Ce primești
O pagină nouă în contul de admin, „Raport sesiune”, cu:
- selector de sesiune (implicit cea activă) și filtru pe clasă (sau toate clasele);
- pentru fiecare clasă, un tabel cu elevii (Nume Prenume, ordonați după nume);
- câte o coloană pentru fiecare zi lucrătoare din sesiune (luni–vineri, dată zz.ll.aaaa), cu orele realizate în acea zi (maxim 4 contabilizate);
- celula e verde dacă elevul are 4 ore, roșie dacă are mai puțin;
- coloana finală „Absențe” = suma orelor nerealizate (4 − ore realizate, pentru fiecare zi sub 4);
- export PDF (landscape) și CSV, pe clasa selectată sau pe toate clasele.

## Reguli de calcul
- Ore realizate = ore din evenimentele la care elevul a fost marcat „Prezent” sau „Întârziat” (evenimente nefinalizate/anulate/ciorne nu contează).
- Plafon: maxim 4 ore pe zi (regula existentă).
- Zile considerate: doar luni–vineri din intervalul sesiunii; sâmbăta/duminica nu apar.
- Zilele încă neîncheiate (azi și viitoare) nu se numără la absențe.

## Detalii tehnice
- Pagină nouă `src/pages/admin/SessionAbsenceReportPage.tsx`, rută `/admin/session-report`, link în meniul admin.
- Date încărcate pe bucăți (`fetchInChunks` / `.range()`) — clase, asignări, evenimente din sesiune, rezervări, bilete cu status present/late.
- Funcție pură `computeDailyAbsences` în `src/lib/student-hours.ts` + test unitar (4h → 0 absențe, 2h → 2, 0h → 4, 6h → plafonat la 4, weekend ignorat).
- Export prin `exportReportPdf` și `exportToCSV` existente.
- Fără modificări în baza de date.
