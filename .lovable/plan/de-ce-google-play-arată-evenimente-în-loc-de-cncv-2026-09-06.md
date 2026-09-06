# De ce Google Play arată „Evenimente" în loc de „CNCV"

## Diagnostic (verificat)

Numele din aplicație **este deja schimbat corect** în cod:

- `android/app/src/main/res/values/strings.xml` → `app_name = CNCV`
- `capacitor.config.ts` → `appName: CNCV`

Deci build-ul nou (versiunea 1.20+) se va instala pe telefon cu numele **CNCV** sub iconiță.

Numele afișat în **magazinul Google Play** (pagina aplicației, rezultatele de căutare) nu vine din cod — este setat manual în **Google Play Console** și nu se schimbă automat la un build nou.

## De ce încă vezi „Evenimente"

Două cauze posibile, probabil ambele:

1. **Listarea din Play Console** — numele magazinului (Store listing) a rămas „Evenimente CNCV" de la prima publicare.
2. **Telefonul tău are build-ul vechi** — dacă n-ai încărcat în Play Console un build nou (1.20+), aplicația instalată din magazin e versiunea veche, cu numele vechi sub iconiță.

## Ce trebuie făcut (manual, în Google Play Console)

1. **Numele magazinului**: Play Console → aplicația ta → **Grow → Store presence → Main store listing** → câmpul **App name** → schimbi în „CNCV" (sau „CNCV — Cantemir Vodă") → Save. Modificarea poate necesita review Google (de obicei câteva ore).
2. **Build nou pe telefoane**: pentru ca numele de sub iconiță să devină CNCV la utilizatori, trebuie încărcat build-ul 1.21+ (AAB) în Play Console și publicat un release nou. După ce utilizatorii primesc update-ul, numele de pe telefon se schimbă.

## Notă

- Bundle ID rămâne `com.evenimentecncv.app` — **nu se poate schimba** după publicare, dar este invizibil pentru utilizatori, deci nu e o problemă.
- Nicio modificare de cod nu este necesară — partea de aplicație e deja corectă.
