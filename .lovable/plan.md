
## Plan: Filtrare pe sesiune activă în AdminScanPage

### Problemă
Selectorul de evenimente din `AdminScanPage` afișează toate evenimentele (inclusiv istorice din sesiuni vechi), îngreunând selecția.

### Soluție
Adaug un selector de sesiune deasupra selectorului de evenimente, pre-selectând automat sesiunea activă.

### Modificări — `src/pages/admin/AdminScanPage.tsx`
1. **Fetch sesiuni** la mount: `program_sessions` ordonate `start_date desc`.
2. **Auto-select sesiune activă**: prima cu `status='active'`, fallback la cea mai recentă.
3. **Selector sesiune** (Select) deasupra selectorului de evenimente: „Toate sesiunile" + listă sesiuni (nume + an academic).
4. **Filtrare evenimente**: query `events` cu `.eq('session_id', selectedSessionId)` când e aleasă o sesiune; reset `selectedEventId` la schimbare.
5. **Pre-selecție din URL** (`?event=`): dacă vine cu `event` param, fetch evenimentul, setez `selectedSessionId` pe sesiunea lui și apoi `selectedEventId`.

### Ce NU se schimbă
- Logica de scanare, RLS, alte fișiere.
