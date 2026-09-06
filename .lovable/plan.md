# Numele „CNCV" peste tot

## Ce e deja corect (verificat)

- `android/.../strings.xml`: `app_name` și `title_activity_main` = CNCV
- `capacitor.config.ts`: `appName: 'CNCV'`
- `ios/App/App/Info.plist`: `CFBundleDisplayName` = CNCV

Deci numele de sub iconiță pe telefon este deja CNCV (în build-ul 1.22).

## Ce a rămas „Evenimente" (verificat)

1. `index.html` — titlul paginii web și textele de partajare:
   - `<title>Evenimente CNCV</title>`
   - `og:title` și `twitter:title` = „Evenimente CNCV"
2. `public/manifest.webmanifest` — nu are deloc `name` / `short_name`, deci la instalarea ca aplicație web numele vine din titlul paginii.
3. `package.json` — `"name": "vite_react_shadcn_ts"` (intern, invizibil pentru utilizatori).

## Ce voi schimba

1. `index.html`: titlu → „CNCV — Colegiul Național Cantemir Vodă", plus `og:title` și `twitter:title` la fel; descrierea rămâne, ajustată la platforma școlii.
2. `public/manifest.webmanifest`: adaug `"name": "CNCV"`, `"short_name": "CNCV"`, `start_url`, `display: standalone`.
3. `package.json`: `"name": "cncv"`.

## Ce nu se poate / nu se schimbă

- `com.evenimentecncv.app` (identificatorul aplicației) — nu se poate schimba după publicare, dar e invizibil pentru utilizatori.
- Numele profilului de provisioning iOS („Evenimente CNCV App Store") — e o etichetă din contul Apple Developer, nu se vede nicăieri în aplicație.
- Numele afișat în **Google Play** vine din Play Console (Store listing → App name), nu din cod. Trebuie schimbat manual acolo.

## Detaliu tehnic suplimentar

În iOS, `CURRENT_PROJECT_VERSION` este 6 în timp ce `MARKETING_VERSION` este 1.22. Îl pot alinia la 22 la următorul bump dacă vrei.
