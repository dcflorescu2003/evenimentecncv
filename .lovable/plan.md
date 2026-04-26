## Diagnostic

Din logs și din lista de secrets:

- Secret-ul existent: `FIREBASE_SERVICE_ACCOUNT_KEY` ✅
- Secret-ul citit de cod: `FCM_SERVICE_ACCOUNT_JSON` ❌ (nu există)
- Rezultat: blocul FCM e sărit, `fcmProjectId = null` → UI-ul afișează „Project=?” și „fără token-uri FCM”.
- VAPID key (`VAPID_PRIVATE_KEY`) e setat dar într-un format pe care `crypto.subtle.importKey` nu îl acceptă (`Invalid key usage`).
- În `fcm_tokens` există 7 device-uri Android înregistrate, deci hook-ul `useCapacitorPush` funcționează — dar **user-ul tău admin actual probabil nu are token salvat** (te-ai logat ca admin pe web, nu pe APK-ul cu telefonul).

## Modificări

### 1. `supabase/functions/send-push-to-user/index.ts`

- Citește serviciul FCM din **ambele** nume de secret (compatibilitate): `FIREBASE_SERVICE_ACCOUNT_KEY` (preferat) sau `FCM_SERVICE_ACCOUNT_JSON` (fallback).
- Întoarce în răspuns: `fcmConfigured` (boolean), `webPushConfigured` (boolean), `tokensFound` (numărul de tokene găsite pentru user_id), și mesaje de eroare clare.
- Pune blocul Web Push într-un `try/catch` care nu mai loghează ca eroare absența VAPID — doar dacă chiar e setat și eșuează.
- La eroarea de import VAPID, marchează `webPushConfigured = false` și continuă (nu mai blochează).

### 2. `supabase/functions/send-event-reminders/index.ts`

Aceeași schimbare de citire a secretului FCM (`FIREBASE_SERVICE_ACCOUNT_KEY` cu fallback).

### 3. `src/pages/admin/AdminDashboard.tsx` (butonul de test push)

- Afișează un mesaj mai clar: `FCM: configurat ✓ / nu`, `tokene găsite: N`, `trimise: M`.
- Dacă `tokensFound === 0` pentru user-ul curent → spune clar: „User-ul X nu are niciun device Android înregistrat. Logează-te în aplicația Android cu acest user pentru a salva tokenul.”

### 4. (Opțional, dacă vrei web push să meargă)

VAPID_PRIVATE_KEY trebuie să fie cheia privată EC P-256 în format **base64url raw** (32 bytes). Dacă o ai în PEM, trebuie regenerată cu `npx web-push generate-vapid-keys` și salvată ca atare. Dar asta e un secret pe care îl actualizezi tu manual — nu e ceva pe care îl putem face din cod. Pentru Android nu contează (folosim FCM, nu Web Push).

## Pași de verificare după implementare

1. Deploy automat la `send-push-to-user` și `send-event-reminders`.
2. Apeși butonul de test push în AdminDashboard.
3. Răspunsul ar trebui să arate `fcmConfigured: true`, `fcmProjectId: <numele real>`, și `tokensFound: N`.
4. Dacă `tokensFound = 0`, te loghezi în APK pe Android cu user-ul respectiv → tokenul se salvează automat → reîncerci.

## Note tehnice

- Nu modificăm `useCapacitorPush.ts` — funcționează corect (există tokene în DB).
- Nu modificăm `AndroidManifest.xml` — e configurat OK.
- Numele secretului în Lovable Cloud rămâne `FIREBASE_SERVICE_ACCOUNT_KEY` (nu trebuie să adaugi unul nou).