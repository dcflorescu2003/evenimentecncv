# Corectarea antetului sub bara de stare Android

## Obiectiv
Antetul aplicației, inclusiv sigla CNCV și butonul de ieșire, va începe sub bara de stare a telefonului, fără să se suprapună peste ceas, semnal, baterie sau notificări.

## Pași
1. Înlocuiesc gestionarea veche a barei de stare cu mecanismul modern inclus în Capacitor 8, compatibil cu afișarea „edge-to-edge” obligatorie în Android 16.
2. Actualizez regulile comune pentru zona sigură astfel încât să folosească valorile native corecte furnizate de Android, cu fallback pentru iOS și browser.
3. Păstrez înălțimea vizuală actuală a antetului, dar adaug separat spațiul ocupat de bara de stare; actualizez și distanțierele/meniurile lipite de antet ca să nu apară goluri sau suprapuneri.
4. Aplic soluția comună tuturor ecranelor care folosesc antetul CNCV: selectorul de module, elev, profesor, diriginte, asistent, portofoliu, manager și admin.
5. Verific afișarea pe mobil și desktop, apoi verific proiectul pentru erori.

## Detalii tehnice
- Proiectul țintește Android API 36. În această versiune, `StatusBar.setOverlaysWebView({ overlay: false })` nu mai poate opri suprapunerea barei de sistem.
- Configurația va folosi `SystemBars` cu gestionarea CSS a marginilor native.
- Utilitățile din `src/index.css` vor citi `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))` și echivalentele pentru celelalte margini.
- Inițializarea din `src/main.tsx` și setările din `capacitor.config.ts` vor fi aliniate cu API-ul Capacitor 8.
- Nu modific funcționalitatea, navigarea sau aspectul cardurilor din imagine.
