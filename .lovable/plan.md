
## Plan: Fix safe-area inferior pentru toate layout-urile

### Problemă
Pe mobil (în special iOS/Android cu home indicator sau bara de navigare), butoanele din partea de jos a layout-urilor sunt acoperite de bara sistemului:
- **Admin**: butonul „Logout" din `SidebarFooter` nu e accesibil
- **Student**: bottom navigation (Panou/Evenimente/Bilete) e parțial acoperită
- **Coordinator/Prof/Teacher/Manager**: footer/conținut tăiat

În `src/index.css`, `body` are deja `padding-bottom: env(safe-area-inset-bottom)`, DAR:
- Layout-urile cu `min-h-screen` + header `sticky` + bottom nav `fixed` ignoră padding-ul de pe body
- `StudentLayout` are `<nav className="fixed bottom-0 ...">` fără safe-area
- `AdminLayout` sidebar ocupă toată înălțimea, footer-ul e la `100vh` — pe mobil bara sistemului îl acoperă

### Soluție — un singur pattern aplicat consistent

**1. `src/index.css`** — adaug utility class:
```css
.pb-safe { padding-bottom: max(env(safe-area-inset-bottom), 0.5rem); }
.bottom-safe { bottom: env(safe-area-inset-bottom); }
```
Și elimin/ajustez padding global pe `body` (acum dublează în unele layout-uri).

**2. `src/components/layouts/StudentLayout.tsx`**
- Bottom nav `fixed`: adaug `pb-[env(safe-area-inset-bottom)]` pe `<nav>` și măresc `pb-20` → `pb-24` pe `<main>` ca să nu acopere conținutul.

**3. `src/components/layouts/AdminLayout.tsx`**
- `SidebarFooter` → adaug `pb-[max(env(safe-area-inset-bottom),0.75rem)]`
- `<main>` din `SidebarInset` → adaug `pb-safe`

**4. `src/components/layouts/ManagerLayout.tsx`** (analog cu Admin) — verific în implementare.

**5. `src/components/layouts/CoordinatorLayout.tsx`**
- `<main>` → adaug `pb-safe` (extra ~16px pe mobil)

**6. `src/components/layouts/ProfLayout.tsx`** și **`TeacherLayout.tsx`**
- `<main>` → adaug `pb-safe`

**7. Pagini cu butoane sticky/fixed la bottom** (verific în implementare):
- `StudentScanPage`, `ProfScanPage`, `CoordinatorScanPage` — eventual butoane „Înapoi"/„Confirmă" care pot cădea sub bara sistemului.

### Pattern aplicat
- `<main>` pe toate layout-urile non-sidebar: `pb-[max(env(safe-area-inset-bottom),1rem)]` (sau clasa `pb-safe`)
- Bottom navs `fixed`: `pb-[env(safe-area-inset-bottom)]` pe container + `bottom-0` (safe-area se adaugă în interior cu padding)
- Sidebar footers: padding inferior crescut cu `env(safe-area-inset-bottom)`

### Fișiere modificate
1. `src/index.css` — utility classes `pb-safe`
2. `src/components/layouts/AdminLayout.tsx` — sidebar footer + main
3. `src/components/layouts/ManagerLayout.tsx` — sidebar footer + main (de citit)
4. `src/components/layouts/StudentLayout.tsx` — bottom nav + main padding
5. `src/components/layouts/CoordinatorLayout.tsx` — main padding
6. `src/components/layouts/ProfLayout.tsx` — main padding
7. `src/components/layouts/TeacherLayout.tsx` — main padding

### Ce NU se schimbă
- Logica de business, RLS, edge functions
- Structura header-elor (rămân sticky top cu safe-area-top deja activ pe body)
