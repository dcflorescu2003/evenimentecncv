
## Plan: Admin poate scana bilete la orice eveniment

### Context
În acest moment scanarea de bilete e disponibilă doar pentru:
- **Coordonator** (`/coordinator/scan`) — bazat pe `coordinator_assignments`
- **Profesor/Diriginte** (`/prof/scan`) — pentru evenimentele proprii
- **Elev asistent** (`/student/scan`) — pentru evenimente în care e asistent

Adminul nu are o pagină dedicată de scanare. RLS-urile pe `tickets` / `public_tickets` permit deja adminului `ALL` (manage), deci permisiunile sunt OK — lipsește doar UI-ul.

### Soluție — minimă, refolosind logica existentă

**1. Pagină nouă `src/pages/admin/AdminScanPage.tsx`**
- Bazată pe `ProfScanPage` (cea mai apropiată ca funcționalitate — admin poate scana orice eveniment, fără restricții de creator).
- Selector de eveniment: dropdown cu toate evenimentele din sesiunea curentă (sau picker pe date), nu doar cele create de user.
- Query: `events` filtrat pe sesiunea activă (sau toate), ordonate desc după `date`.
- Reutilizează aceeași logică de scanare QR + listă de prezență (html5-qrcode + `attendance.ts`).
- Identic cu fluxul prof: scan QR → găsește ticket (intern sau public) → marchează `present`/`late` în funcție de fereastra de timp (memoria `attendance-verification`).

**2. Rută în `src/App.tsx`**
- `/admin/scan` → `AdminScanPage` în `AdminLayout`, protejat cu `ProtectedRoute role="admin"`.

**3. Link în meniul AdminLayout**
- Adaug intrare „Scanare bilete" cu icon `QrCode` (lucide) în `menuItems` din `AdminLayout.tsx`.

**4. Buton rapid „Scanare bilete" pe `EventDetailPage` admin**
- În `src/pages/admin/EventDetailPage.tsx` adaug un buton care deschide `/admin/scan?event=<id>`.
- `AdminScanPage` citește `?event=` din URL și pre-selectează evenimentul.

### Ce NU se schimbă
- RLS, schema DB (adminul are deja `ALL` pe tickets/public_tickets/attendance_log).
- Logica de validare prezență, ferestre de timp, rotunjire ore.
- Paginile existente de scan (coordinator/prof/student).

### Fișiere modificate/create
1. **NOU**: `src/pages/admin/AdminScanPage.tsx` (variantă din `ProfScanPage` cu selector de eveniment fără filtru pe creator)
2. `src/App.tsx` — rută `/admin/scan`
3. `src/components/layouts/AdminLayout.tsx` — item de meniu
4. `src/pages/admin/EventDetailPage.tsx` — buton „Scanare bilete" către `/admin/scan?event=<id>`
