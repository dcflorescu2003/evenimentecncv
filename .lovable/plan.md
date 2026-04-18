
## Plan: Pregătire pentru publicare pe App Store

### 1. Pagină nouă de Suport
**Fișier nou** `src/pages/public/SupportPage.tsx` (similar ca structură cu `PrivacyPolicyPage.tsx`):
- Titlu: „Suport și asistență"
- Secțiuni:
  - **Contact** — email `lcantemirvoda@yahoo.com`, instituția (CNCV București)
  - **Întrebări frecvente (FAQ)** — autentificare, schimbare parolă, rezervare bilete, scanare QR, ștergere cont
  - **Probleme tehnice** — instrucțiuni (reîncărcare, deconectare/reconectare, contact email)
  - **Resetare parolă** — pașii (cere admin/diriginte)
  - **Ștergere cont** — link către `/delete-account`
  - **Politica de confidențialitate** — link către `/privacy`
- Buton „Înapoi" în stânga sus

**Rută nouă** în `src/App.tsx`: `/support` → `<SupportPage />` (publică, fără auth)

### 2. Link Suport sub link Confidențialitate
În `PrivacyPolicyPage.tsx` adaug la final un link către `/support`. În plus, adaug pe `Login.tsx` (și/sau footer comun) link-uri vizibile către `/privacy` și `/support` pentru a fi accesibile reviewer-ului App Store.

### 3. Configurare App Store (iOS — Capacitor)
**`ios/App/App/Info.plist`** — adaug chei obligatorii cerute de App Store Review:
- `NSCameraUsageDescription` — „Aplicația folosește camera pentru a scana coduri QR la check-in la evenimente."
- `NSPhotoLibraryUsageDescription` — „Aplicația poate salva bilete în galerie." (dacă e cazul)
- `ITSAppUsesNonExemptEncryption` = `false` (evită completare formular criptare)
- `CFBundleShortVersionString` deja `$(MARKETING_VERSION)` — OK
- Verific `LSApplicationQueriesSchemes` dacă e necesar

**`capacitor.config.ts`** — verific:
- `appId` corect: `com.evenimentecncv.app`
- `appName`: `Evenimente`
- **Elimin** `server.url` (hot-reload) pentru build production — App Store respinge build-uri care încarcă din URL extern

### 4. Metadata pentru App Store Connect
Document `APPSTORE_SUBMISSION.md` la rădăcina proiectului cu:
- **App name**: Evenimente CNCV
- **Subtitle**: Evenimente Colegiul Cantemir Vodă
- **Categorie**: Education
- **Keywords**: școală, evenimente, CNCV, Cantemir, prezență, bilete
- **Descriere** (RO) — text gata de copiat
- **What's new** — text versiune inițială
- **URL Suport**: `https://evenimentecncv.online/support`
- **URL Confidențialitate**: `https://evenimentecncv.online/privacy`
- **Demo account** pentru review: `elev.test / Elev123!` (cont test existent)
- **Note pentru reviewer**: explicație flux școlar, conturi gestionate de admin
- **Age rating**: 4+
- **Export Compliance**: Nu folosește criptare proprietară
- **Asset list necesar** (de generat manual de user în Xcode/App Store Connect):
  - App Icon 1024×1024
  - Screenshots iPhone 6.7" și 6.5" (min 3)
  - Screenshots iPad 12.9" (dacă suportă iPad — momentan suportă, pot scoate iPad din target)

### 5. Checklist final pentru user (în chat după implementare)
- `npx cap sync ios` după modificări
- Build în Xcode cu certificat de distribuție Apple Developer
- Upload prin Xcode Organizer sau Transporter
- Completare metadata în App Store Connect folosind `APPSTORE_SUBMISSION.md`

### Fișiere modificate/create
1. **Nou**: `src/pages/public/SupportPage.tsx`
2. **Modificat**: `src/App.tsx` (rută `/support`)
3. **Modificat**: `src/pages/public/PrivacyPolicyPage.tsx` (link spre suport)
4. **Modificat**: `src/pages/Login.tsx` (linkuri footer privacy + support)
5. **Modificat**: `ios/App/App/Info.plist` (permission descriptions + encryption flag)
6. **Modificat**: `capacitor.config.ts` (clarificare server.url pentru production)
7. **Nou**: `APPSTORE_SUBMISSION.md` (metadata + checklist)

### Ce NU se schimbă
- Logica aplicației, RLS, edge functions, schema DB.
- Android config (deja funcțional pentru Play Store separat).
