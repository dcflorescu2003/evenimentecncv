## Problemă

Pe telefoane fără bară fizică (iPhone cu notch / Dynamic Island, Android cu gesture bar), conținutul aplicației se poate suprapune peste bara de status (sus) sau peste bara de gesturi/butoane (jos). Suportul actual e parțial: doar `StudentLayout` are bara de jos cu `safe-area-inset-bottom`, iar header-urile sunt `sticky top-0` care primesc padding global pe `body`, dar nu toate situațiile sunt acoperite.

## Ce e deja OK

- `<meta viewport viewport-fit=cover>` setat în `index.html` ✅
- `body` are `padding-top/left/right: env(safe-area-inset-*)` în `index.css` ✅
- `StudentLayout` (bottom nav) folosește `safe-area-inset-bottom` ✅
- Utilitățile `.pb-safe` și `.pb-safe-nav` există ✅

## Ce trebuie ajustat

1. **Status bar pe iOS (Capacitor)** — instalez `@capacitor/status-bar` și îl configurez să nu se suprapună peste WebView (`setOverlaysWebView({ overlay: false })` pe Android, stil corect pe iOS). Cu `viewport-fit=cover` lăsăm CSS-ul `env(safe-area-inset-*)` să gestioneze marginile, iar status bar-ul rămâne vizibil cu fundal transparent peste conținut.

2. **Header-ele sticky** din toate layout-urile (Student, Admin, Manager, Prof, Teacher, Coordinator) — momentan `top-0` lipește header-ul de marginea WebView-ului. După `padding-top` pe body, header-ul sticky se „lipește" sub notch corect, dar trebuie verificat că nu pierde fundalul în zona safe-area. Adaug pe header un `bg` extins cu `margin-top: calc(-1 * env(safe-area-inset-top))` + `padding-top: env(safe-area-inset-top)` pentru ca fundalul header-ului să acopere și zona din spatele notch-ului (altfel se vede transparent).

3. **Pagini de login / public / scan** care folosesc `min-h-screen` fără layout — adaug clasa `pb-safe` pe containerele care au butoane jos (ex: `Login`, `PublicEventBookingPage`, `ChangePassword`).

4. **Mărire safe-area** — utilitățile devin:
   - `.pt-safe` = `max(env(safe-area-inset-top), 0.5rem)`
   - `.pb-safe` = `max(env(safe-area-inset-bottom), 1rem)` (deja există)
   - `.pb-safe-nav` rămâne pentru bottom nav
   
5. **Splash screen / status bar overlay pe Android** — pe Android cu gesture navigation, sistemul afișează un „pill" jos. Cu `overlaysWebView=false` (configurabil în `capacitor.config.ts` prin `StatusBar` plugin), sistemul rezervă spațiu automat și nu mai trebuie nimic special. Setez explicit acest comportament.

## Fișiere modificate

- `package.json` — adaug `@capacitor/status-bar`
- `capacitor.config.ts` — adaug bloc `plugins.StatusBar` cu `overlaysWebView: false` (Android) și `style: 'default'`
- `src/index.css` — adaug `.pt-safe`, ajustez `body` (păstrez padding) și adaug helper pentru header-e (`.header-safe` cu fundal extins)
- `src/components/layouts/StudentLayout.tsx` — header primește `header-safe`
- `src/components/layouts/AdminLayout.tsx` — header primește `header-safe`
- `src/components/layouts/ManagerLayout.tsx` — header primește `header-safe`
- `src/components/layouts/ProfLayout.tsx` — header primește `header-safe`, adaug `pb-safe` pe main dacă nu există nav fix
- `src/components/layouts/TeacherLayout.tsx` — la fel
- `src/components/layouts/CoordinatorLayout.tsx` — la fel
- `src/main.tsx` (sau un init dedicat) — apel `StatusBar.setOverlaysWebView({ overlay: false })` pe native, ca să fim safe pe Android

## Pași pentru tine pe Mac (după pull)

```bash
npm install
npx cap sync
```

Apoi rulezi pe device fizic — niciun pas suplimentar în Xcode (status bar plugin nu cere capabilities).

## Cum verificăm

- iPhone cu notch / Dynamic Island → header-ul are fundal sub notch, conținutul nu e tăiat
- Android cu gesture bar → bottom nav (la elev) și butoanele de jos din pagini nu se ascund sub bara de gesturi
- Telefoane vechi cu butoane fizice → niciun spațiu inutil (folosim `max(env(...), fallback)`)
