# Optimizare mobilă pentru aplicația Admin

Scop: toate paginile Admin trebuie să fie utilizabile confortabil pe ecran de telefon (≤640px), fără scroll orizontal nedorit, cu butoane atinse ușor (≥44px), tabele transformate în carduri și dialoguri care încap pe ecran.

## Probleme identificate

1. **AdminLayout** – padding `p-6` prea mare pe mobil, headerul nu afișează titlul paginii.
2. **ClassesPage** – tabelele Gimnaziu/Liceu sunt afișate pe mobil fără scroll/transformare → rând cu 5 coloane se sparge urât. Acțiunile (Reguli + Acțiuni) sunt înghesuite.
3. **EventDetailPage** – are 4 tabele mari (participanți, profesori coordonatori, asistenți elevi, fișiere) fără variantă mobilă; headerul cu titlu + butoane nu se înfășoară bine; tab-urile pot deborda.
4. **ReportsPage** – 3 tabele de raport fără variantă mobilă; filtrele (selectoare) nu sunt grupate vertical pe mobil.
5. **ImportPage** – 3 tabele (preview CSV, erori, rezultate) fără scroll orizontal.
6. **CredentialsPage** – listă utilizatori și butoane de generare PDF nu sunt verificate pe mobil.
7. **AdminScanPage** – verificat că zona de cameră QR + listă scanări recente se adaptează (font-size + padding).
8. **Dialog-uri** – câteva dialoguri mari (editare clasă, asignare diriginte, listă elevi) fără `max-h` + scroll pe mobil.

## Modificări planificate

### `src/components/layouts/AdminLayout.tsx`
- Padding responsiv: `p-3 sm:p-4 md:p-6` în `<main>`.
- Header sticky cu `SidebarTrigger` + nume pagină curentă (preluat din rută) – titlu vizibil pe mobil.

### `src/pages/admin/ClassesPage.tsx`
- Header: stack vertical cu butoane full-width pe mobil (deja parțial făcut – verificare).
- Tab Gimnaziu: tabel ascuns sub `md`; afișare ca listă de carduri (clasă, diriginte cu buton edit, elevi count, badge-uri reguli, acțiuni cu icon-uri 36px).
- Tab Liceu: în interiorul fiecărui Accordion, același pattern card pentru mobil.
- Dialog "Elevi" și "Editare clasă": `max-w-[calc(100vw-2rem)]` + scroll intern.

### `src/pages/admin/EventDetailPage.tsx`
- Header titlu + acțiuni: stack vertical sub `sm`, butoane full-width, tab-list cu `overflow-x-auto`.
- Tabel participanți, profesori coordonatori, asistenți elevi, fișiere: variantă card pe mobil (`md:hidden` cards + `hidden md:block` tabel). Pentru fiecare card – nume + meta + acțiuni stacked.
- Card-urile cu informații despre eveniment: grid `grid-cols-1 sm:grid-cols-2`.

### `src/pages/admin/ReportsPage.tsx`
- Filtre: `flex-col sm:flex-row` cu select-uri full-width pe mobil.
- Cele 3 tabele: variantă card pe mobil (rezumat per linie + valori sub formă de label/value).
- Butoane Export PDF/CSV: full-width pe mobil.

### `src/pages/admin/ImportPage.tsx`
- Tabel preview, erori, rezultate: wrapper `overflow-x-auto` + font mai mic pe mobil.
- Zona de upload + selectoare: stack vertical, butoane full-width.

### `src/pages/admin/CredentialsPage.tsx`
- Filtre & butoane generare: stack vertical + full-width pe mobil.
- Listă utilizatori: card-uri sub `sm`.

### `src/pages/admin/AdminScanPage.tsx`
- Zonă cameră responsivă (`aspect-square w-full max-w-md`).
- Listă scanări recente cu padding redus pe mobil + truncate pe nume lungi.
- Butoane control (start/stop, switch listă manuală) full-width pe mobil.

### Sweep general (toate paginile Admin)
- Header titlu + butoane: pattern `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`.
- Toate `Dialog`/`AlertDialog` mari primesc `max-h-[90vh] overflow-y-auto` și `max-w-[calc(100vw-2rem)] sm:max-w-lg`.
- Înlocuim `gap-6` cu `gap-4 md:gap-6` unde e cazul pentru a economisi spațiu pe mobil.
- Iconuri-only buttons în acțiuni primesc `h-9 w-9` (target tap 36px) pe mobil.

## Detalii tehnice

- Pattern repetat pentru tabele: păstrăm `<Table>` original cu `hidden md:block`, adăugăm un `<div className="md:hidden space-y-2">` cu carduri compacte (deja folosit în UsersPage / EventsPage / SessionsPage / AuditPage – aplicăm același pattern peste tot pentru consistență).
- Nu se modifică logica de date / queries / mutations – doar markup și clase Tailwind.
- Nu se introduce nicio dependență nouă.

## Fișiere afectate

- `src/components/layouts/AdminLayout.tsx`
- `src/pages/admin/ClassesPage.tsx`
- `src/pages/admin/EventDetailPage.tsx`
- `src/pages/admin/ReportsPage.tsx`
- `src/pages/admin/ImportPage.tsx`
- `src/pages/admin/CredentialsPage.tsx`
- `src/pages/admin/AdminScanPage.tsx`

## În afara scopului

- Nu modificăm structura datelor sau RLS.
- Nu refacem complet design-ul; păstrăm look & feel actual, doar adaptăm pentru mobil.
- Nu atingem rolurile non-admin (Student, Teacher, Coordinator, Manager, Prof) – cele student/teacher/coordinator/manager au fost deja optimizate anterior. Dacă observ în drum probleme evidente la layout-urile partajate, le menționez fără să le modific.

---

## Implementare finalizată (Admin mobile)

- **AdminLayout**: padding responsiv `p-3 sm:p-4 md:p-6`; header sticky cu titlul paginii vizibil pe mobil.
- **ClassesPage**: tabelele Gimnaziu și Liceu (în Accordion) au variantă card compactă pe mobil cu `ClassCardComponent`; TabsList full-width pe mobil; toate dialogurile primesc `max-w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto`.
- **EventDetailPage**: header titlu+acțiuni stack vertical pe mobil, titlu cu wrap; TabsList scrollabil orizontal pe mobil; toate cele 4 tabele wrapped în `overflow-x-auto`; secțiuni de header `flex-col sm:flex-row`; toate dialogurile mobile-fit.
- **ReportsPage**: TabsList full-width pe mobil; toate cele 3 tabele cu `overflow-x-auto`; filtrul StudentReport stack vertical pe mobil cu butoane full-width.
- **ImportPage**: tabel "Importuri recente" wrapped în `overflow-x-auto`; toate rândurile de acțiuni (preview, results) `flex-col gap-3 sm:flex-row sm:justify-between` cu butoane `flex-wrap`.
- **CredentialsPage**: spațiere și grid optimizate pentru mobil (`sm:grid-cols-3` în loc de `md:grid-cols-3`).
- **AdminScanPage**: deja mobile-friendly (TabsList full-width, butoane w-full, scanner max-w-sm).

Type-check: trecut.
