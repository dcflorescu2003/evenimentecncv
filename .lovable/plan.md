

## Plan: Fix nav bar overlap pe Android gestural + previne swipe-back pe tabele iOS

### Problema 1: Butoanele de navigare se suprapun cu bara de navigare Android
Pe telefoanele Android cu navigare gestuală (fără butoane fizice), zona de gesture overlap cu bara de navigare a aplicației. `env(safe-area-inset-bottom)` nu e suficient — în Capacitor/WebView pe Android, aceste valori sunt adesea 0 chiar dacă există gesture bar.

**Soluție:**
1. **`StudentLayout.tsx`** — măresc padding-ul implicit minim de la `0.5rem` la `1.25rem` (`20px`) pentru a acoperi gesture bar-ul Android (de obicei ~48px cu padding). Formula: `max(env(safe-area-inset-bottom), 1.25rem)`.
2. **`index.css`** — actualizez `.pb-safe-nav` pentru conținutul din spatele nav-ului: `calc(env(safe-area-inset-bottom) + 6rem)` (mai mult spațiu).
3. **Capacitor config** — adaug `statusBar` și `android.backgroundColor` + `plugins.StatusBar` pentru a seta corect safe areas pe Android WebView.
4. **`CoordinatorLayout.tsx`** — aceeași ajustare la footer padding.

### Problema 2: Swipe left pe tabele declanșează „back" pe iPhone
Pe iOS Safari/WebView, swipe de la marginea stângă = navigare înapoi. Tabelele cu scroll orizontal intră în conflict.

**Soluție:**
1. Creez o clasă CSS utilitar `.overscroll-x-contain` cu `overscroll-behavior-x: contain` — previne propagarea swipe-ului către browser.
2. Aplic această clasă pe toate containerele `overflow-x-auto` din paginile cu tabele (manager reports, admin audit, teacher reports).
3. Adaug `touch-action: pan-x` pe containerele de tabel pentru a indica explicit browserului că swipe-ul e pentru scroll, nu navigare.

### Fișiere modificate
- `src/index.css` — utilitar nou `.overscroll-x-contain`, update `.pb-safe-nav`
- `src/components/layouts/StudentLayout.tsx` — padding minim mai mare
- `src/components/layouts/CoordinatorLayout.tsx` — padding footer
- `src/pages/manager/*.tsx` (6 fișiere) — adaug `overscroll-behavior-x: contain`
- `src/pages/admin/AuditPage.tsx` — adaug `overscroll-behavior-x: contain`

### Ce NU se schimbă
- Schema DB, RLS, edge functions, logica de business.

