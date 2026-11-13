# Orar: actualizare elevi + orar propriu, Săli și Cancelarie pentru profesori

## 1. Actualizarea orarelor (din cele 4 fișiere)
- Înlocuiesc orarul tuturor celor 32 de clase cu `orar_elevi_import_1.xml`.
- Folosesc orarul profesorilor, al cancelariei și al sălilor pentru verificare încrucișată: aceeași oră trebuie să aibă aceeași clasă, sală și același profesor în toate fișierele. Diferențele găsite ți le arăt înainte să le aplic.
- Potrivirea sălilor: 1–12 = Sala 1–12, A = Amfiteatru, B = Biblioteca, Lb = Cabinet Lb, Inf = Info, Cph = Cabinet Psih, info1/info2 = Info1/Info2, AEL = AEL, Lfiz/Lch/Lbio = laboratoarele, sport = Sala de sport. Sălile care nu există (ex. Cabinet Lb, M, E) ți le arăt într-o listă și decizi tu dacă le creez.
- Profesorii: inițialele și numele din cancelarie se potrivesc cu conturile. Te anunț dacă lipsește cineva.

## 2. Ce văd elevii
- În fiecare oră: materia, sala (numele complet din lista ta) și, mai mic, numele complet al profesorului.

## 3. Modulul Orar pentru profesori și diriginți
- Prima pagină: **orarul propriu** + **profesorii de serviciu** (ziua/săptămâna curentă).
- Butoane jos:
  - **Săli** – orarul fiecărei săli; caută după zi și oră ce săli sunt libere.
  - **Cancelarie** – orarul tuturor profesorilor pe zile; căutare coleg după nume (cu sau fără diacritice).
- Toate orarele au filtru **Zi / Săptămână**.

## 4. Import admin pentru anul următor
- Pagină nouă în admin „Import orare”, cu 4 secțiuni: Elevi, Profesori, Cancelarie, Săli. Fiecare are buton „Descarcă model” (XML) și încărcare.
- La import: previzualizare cu potrivirile de săli/profesori și avertismente, apoi confirmare; orarele se regenerează complet.
- Accesul rămâne doar pentru admin.

## Detalii tehnice
- Se păstrează `schedule_entries` (pe clasă); se adaugă legături opționale `room_id` (vr_rooms) și `teacher_id` (profiles), completate la import.
- Orarul profesorilor și al sălilor se calculează din aceleași rânduri (o singură sursă), iar fișierele Profesori/Cancelarie/Săli servesc la validare și completarea profesorilor la grupe („Lf 1 TS / Lf Lb CIS”).
- Parser XML comun cu teste pentru formatul celulelor „materie sală inițiale” și grupe separate prin „/”.
- Citirile pentru Săli/Cancelarie sunt permise profesorilor, diriginților și adminului prin reguli de acces.
