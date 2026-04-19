
## Plan: Apple Sign-In nativ pe iOS (ca la Google)

### Problemă
Pe iOS, când userul apasă „Sign in with Apple", se deschide browser extern (Safari/SFSafariViewController) în loc de sheet-ul nativ Apple. La Google s-a rezolvat deja folosind plugin Capacitor nativ. Trebuie același tratament pentru Apple.

### Investigație necesară (în default mode)
- Verific `package.json` și `capacitor.config.ts` pentru pluginul Google folosit (probabil `@codetrix-studio/capacitor-google-auth` sau `@capacitor-community/firebase-authentication`).
- Caut implementarea curentă de Google nativ în `src/pages/Login.tsx` / hooks.
- Identific unde e butonul Apple și ce funcție apelează (probabil `lovable.auth.signInWithOAuth("apple", ...)` care deschide browser).

### Soluție propusă
Folosesc **`@capacitor-community/apple-sign-in`** — pluginul oficial Capacitor care declanșează `ASAuthorizationAppleIDProvider` nativ pe iOS (sheet-ul de sistem, nu browser).

**Pași implementare:**

1. **Instalare plugin**
   - `npm i @capacitor-community/apple-sign-in`
   - `npx cap sync ios`

2. **Configurare iOS (necesită acțiune user în Xcode + Apple Developer)**
   - Adaug capability „Sign In with Apple" în `ios/App/App.entitlements` (creez fișierul dacă nu există) și-l linkez în `project.pbxproj`.
   - User trebuie să activeze capability-ul în Apple Developer Console pe App ID-ul `app.lovable.c520d087868d4943b5732afeb793cac7` (sau identifier real din `capacitor.config.ts`).

3. **Cod nou — handler nativ Apple**
   - Detectez platforma cu `Capacitor.getPlatform() === 'ios'`.
   - Pe iOS: apelez `SignInWithApple.authorize({ clientId, redirectURI, scopes: 'email name', state, nonce })` → primesc `identityToken` → îl pasez la `supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken, nonce })`.
   - Pe web: păstrez fluxul existent `lovable.auth.signInWithOAuth("apple", ...)`.

4. **Locație cod**
   - Creez `src/lib/native-apple-auth.ts` cu funcția `signInWithAppleNative()`.
   - Modific `src/pages/Login.tsx` (sau componenta cu butonul Apple) să apeleze handler-ul nativ pe iOS.

5. **Configurare Supabase**
   - În Lovable Cloud → Auth → Apple, asigur că „Client ID" e Bundle ID-ul iOS (pentru flux nativ id_token), nu Services ID. Dacă e un singur câmp, folosesc Services ID + adaug Bundle ID în lista de „Authorized client IDs" (necesită BYOC pe Apple).
   - **Dacă proiectul folosește acum managed Apple auth**: pentru flux nativ id_token e nevoie de BYOC (Bring Your Own Credentials) ca să adaug Bundle ID iOS ca audience valid pe token. Voi semnala userului acest pas.

### Fișiere modificate/create
1. `package.json` (+ lock) — `@capacitor-community/apple-sign-in`
2. **NOU** `src/lib/native-apple-auth.ts` — wrapper cu detecție platformă
3. `src/pages/Login.tsx` — folosește wrapper-ul în handler-ul Apple
4. `ios/App/App/App.entitlements` — capability Sign In with Apple
5. `ios/App/App.xcodeproj/project.pbxproj` — link entitlements

### Acțiuni necesare de la user (după implementare)
- `git pull` + `npm install` + `npx cap sync ios`
- În Xcode: deschis proiect, adăugat capability „Sign In with Apple" (dacă entitlements nu se aplică automat).
- În Apple Developer Console: activat „Sign In with Apple" pe App ID iOS.
- În Lovable Cloud Auth → Apple: configurat BYOC dacă nu e deja, cu Bundle ID în „Authorized client IDs".
- Rebuild în Xcode și test pe device fizic.

### Ce NU se schimbă
- Fluxul Apple pe web (rămâne `lovable.auth.signInWithOAuth`).
- Fluxul Google nativ deja funcțional.
- Schema DB, RLS, restul aplicației.
