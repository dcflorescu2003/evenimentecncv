## 1) Adăugare „Feedback" în sidebar-ul Admin

În `src/components/layouts/AdminLayout.tsx`, în `menuItems` (după "Cluburi & Voluntariat"), adăugăm:
```
{ title: "Feedback", icon: MessageSquare, path: "/admin/feedback" }
```
Ruta `/admin/feedback` există deja și folosește `FeedbackListPage` cu `mode="admin"`, care încarcă deja **toate** chestionarele de pe platformă (fără filtru pe creator) — deci adminul vede tot ce există indiferent de modul/rol.

## 2) Date relevante pe pagina Feedback (mod admin)

Extindem `src/pages/feedback/FeedbackListPage.tsx` doar pentru `mode === "admin"`:
- **Bară de statistici** sus (4 carduri mici): Total chestionare, Active, Draft, Închise.
- **Pe fiecare card** afișăm: autorul (Nume Prenume din `profiles` pe `created_by`), numărul de răspunsuri (count pe `feedback_responses` per formular, fetchat în paralel) și data ultimului răspuns. Pentru `teacher_feedback` afișăm și numărul de profesori evaluați (distinct `subject_teacher_id`).
- **Filtre rapide**: status (Toate / Active / Draft / Închise) + căutare după titlu + filtru după tip. Doar UI client-side pe lista existentă.
- Sortare implicită: cele active primele, apoi după `created_at` desc.

Nu modificăm schema bazei de date.

## 3) Optimizare mobil pentru cele 3 module noi

Audit și fix-uri punctuale (toate Tailwind, fără logică):

**Feedback**
- `FeedbackListPage`: headerul `flex items-center justify-between` rupe pe mobil (titlu + buton „Chestionar nou"). Schimbăm în `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between` și butonul `w-full sm:w-auto`. Bara de stats devine `grid-cols-2 sm:grid-cols-4`. Filtrele: `flex flex-col gap-2 sm:flex-row`.
- `FeedbackReportPage`: bara de sus cu Select + 2 butoane Export depășește lățimea pe mobil. O facem `flex-wrap` real cu `w-full sm:w-auto` pe Select și butoane; Select-ul devine `w-full sm:w-[260px]`. Titlurile grupurilor `flex-wrap`.
- `FeedbackEditorPage`: verificăm headerul și butoanele de acțiune să fie `flex-wrap` cu `w-full sm:w-auto`.
- `FeedbackFillPage` / `StudentFeedbackPage`: deja folosesc grid-uri responsive; verificăm doar header.

**Cluburi & Voluntariat**
- `ClubsVolunteerHub`: headerul cu tab-uri + butoane „Club nou / Proiect nou" — flex-wrap + butoane full-width pe mobil. `TabsList` deja are `overflow-x-auto`, ok.
- `ClubDetailPage` și `VolunteerProjectDetailPage`: headerele cu acțiuni multiple (Editează/Șterge/Înscriere) → `flex flex-wrap gap-2`, butoane `w-full sm:w-auto` pe mobil; tabelele de participanți primesc wrapper `overflow-x-auto`.

**Orar & Meniu**
- `StudentSchedulePage`: `TabsList grid-cols-5` (L-V) e prea înghesuit pe ecrane mici → folosim abrevieri (L/Ma/Mi/J/V) pe mobil cu `sm:` text complet, sau `overflow-x-auto` pe tabs. Grila orarului are deja `overflow-x-auto`, ok.
- `ScheduleGridEditor` (admin): are `overflow-x-auto`, dar headerul paginii `SchedulesPage` are nevoie de butoane flex-wrap.
- `CantinaMenuSection`: grid deja responsive.

Toate modificările sunt strict UI/Tailwind; nu schimbăm logica, query-urile sau structura de date.

## Fișiere afectate

- `src/components/layouts/AdminLayout.tsx` — adăugare item Feedback
- `src/pages/feedback/FeedbackListPage.tsx` — stats, filtre, mobile
- `src/pages/feedback/FeedbackReportPage.tsx` — toolbar mobile
- `src/pages/feedback/FeedbackEditorPage.tsx` — header mobile
- `src/components/clubs/ClubsVolunteerHub.tsx` — header mobile
- `src/components/clubs/ClubDetailPage.tsx` — header + tabel mobile
- `src/components/clubs/VolunteerProjectDetailPage.tsx` — header + tabel mobile
- `src/pages/student/StudentSchedulePage.tsx` — tabs mobile
- `src/pages/admin/SchedulesPage.tsx` — header mobile (dacă e cazul)
