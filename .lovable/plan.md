# Export participanți și prezență – Cluburi și Voluntariat

## Ce se adaugă
Pe pagina unui club și a unui proiect de voluntariat (pentru cine le gestionează: admin, organizator, coordonatori; managerul doar vizualizează și poate exporta):

1. **Lista participanților** – butoane „Export PDF” și „Export CSV” în fila Membri / Înscriși.
   Coloane: Nr., Nume Prenume, Clasă, Status înscriere, Data înscrierii. Sortare alfabetică după nume, în ordinea claselor (V–XII).
2. **Lista de prezență** – butoane „Export PDF” și „Export CSV” în fila Întâlniri / Zile.
   - Export general: tabel matrice elevi × întâlniri (P = prezent, Î = întârziat, A = absent, „—” nemarcat), plus coloane totale Prezențe / Absențe.
   - Export pentru o singură întâlnire/zi: listă cu Nr., Nume Prenume, Clasă, Status, plus coloană goală „Semnătură” în PDF (utilă pentru printare).
3. PDF în format landscape pentru matrice, portrait pentru liste; titlu cu numele clubului/proiectului și data generării. Date în format zz.ll.aaaa.

## Detalii tehnice
- Reutilizare `exportReportPdf` / `exportReportPdfSections` și `exportToCSV` existente.
- Helper nou `src/lib/club-volunteer-export.ts` care construiește rândurile pentru ambele module (date încărcate paginat cu `.range()`).
- Prezențele citite din `club_attendance` / `volunteer_attendance` doar pentru întâlnirile clubului/proiectului; clasa elevului din `student_class_assignments`.
- Butoane adăugate în `ClubDetailPage.tsx` și `VolunteerProjectDetailPage.tsx`, vizibile doar pentru roluri cu drept de vizualizare a membrilor (nu pentru elevi simpli).
