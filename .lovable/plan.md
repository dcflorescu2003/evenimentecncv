## Hub de module post-login

După login, în loc să trimitem direct utilizatorul la dashboard-ul rolului său, îl ducem la o pagină nouă **`/app`** cu carduri mari pentru fiecare modul disponibil:

- **Evenimente** — duce la dashboard-ul rolului (echivalentul actual: `/admin`, `/student`, `/prof`, `/manager`, `/coordinator`).
- **Orar & Meniu** — duce la pagina de orar a rolului (`/student/orar`, `/admin/schedules`). Pentru rolurile fără pagină dedicată încă (manager, prof, coordinator), cardul nu apare în această etapă.

Restul aplicației rămâne neschimbat — toate rutele, layout-urile și meniurile existente funcționează identic. Adăugăm doar un nivel deasupra lor.

## Comportament

- La login (sau accesul rădăcinii `/`), utilizatorul autentificat aterizează pe `/app`.
- Utilizatorul nelogat → `/login` (ca acum).
- În `/app`:
  - Salut scurt cu numele utilizatorului + logo CNCV.
  - Grilă responsive de carduri (1 col mobil, 2 col tablet+). Fiecare card: iconiță, titlu, descriere scurtă, click → intră în modul.
  - Doar 2 carduri acum: Evenimente + Orar & Meniu. Structura permite adăugarea ușoară a altora (Feedback, Comunicare etc.).
- În layout-urile rolurilor (Admin/Student/Prof/etc.), în header, adăugăm un buton mic „Module" / iconiță grid care duce înapoi la `/app`, ca să poată comuta între module.
- Logo-ul / titlul din header continuă să ducă la dashboard-ul modulului curent (comportament neschimbat).

## Registry de module

Definim într-un singur fișier (`src/modules/registry.ts`) ce module există și cum se mapează pe roluri:

```text
modules = [
  { key: "events",   label: "Evenimente",     icon: Calendar, pathByRole: { admin: "/admin", student: "/student", ... } },
  { key: "schedule", label: "Orar & Meniu",   icon: BookOpen, pathByRole: { admin: "/admin/schedules", student: "/student/orar" } },
]
```

Hub-ul iterează registry-ul și afișează doar cardurile pentru care rolul curent are o cale definită. Astfel adăugarea unui modul nou înseamnă o singură linie în registry.

## Scope / non-scope acum

- **Da**: hub `/app`, registry, redirect post-login, buton „Module" în header-ele existente.
- **Nu acum** (rămân pentru viitor, conform planului aprobat):
  - tabela `module_access` pentru activare per-rol din UI admin (doar 2 module, suficient registry hardcodat),
  - pagină admin de matrice rol × modul,
  - mutarea rutelor sub prefix `/app/events/...`.

## Detalii tehnice

Fișiere noi:
- `src/modules/registry.ts` — definițiile modulelor + helper `getEnabledModules(roles)`.
- `src/pages/AppHub.tsx` — pagina cu carduri (folosește `Card` din shadcn, semantic tokens, fără culori hardcodate).
- `src/components/ModulesButton.tsx` — buton mic cu iconiță `LayoutGrid` care navighează la `/app`, reutilizabil în toate header-ele de layout.

Fișiere modificate:
- `src/App.tsx` — adaugă ruta `/app` protejată (orice rol autentificat), cu propriul layout minim (header simplu).
- `src/pages/Login.tsx` — toate redirect-urile post-login → `/app` (în loc de `/admin`, `/student` etc.).
- `src/components/layouts/{AdminLayout,StudentLayout,ProfLayout,ManagerLayout,CoordinatorLayout,TeacherLayout}.tsx` — inserează `<ModulesButton />` în header (lângă notificări / meniul user).

Stil: design existent (Burgundy `#7A1F2E`, Inter/Plus Jakarta Sans), carduri cu `hover:shadow-md transition`, iconițe `lucide-react`, UI în română.

Niciun impact pe DB, RLS, edge functions sau auth — schimbare strict de UI + routing.
