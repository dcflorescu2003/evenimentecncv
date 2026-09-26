# Link App Store real + verificare automată a ultimei versiuni

## Ce am găsit

Aplicația e live în App Store: **Evenimente CNCV**, versiunea 1.27, link `https://apps.apple.com/ro/app/evenimente-cncv/id6763886210`.

## Ce construim

### 1. Linkul real de App Store
- Actualizăm `store_url` pentru iOS în tabelul `app_versions` cu linkul real (înlocuiește fallback-ul către căutare).

### 2. Verificare automată a versiunii din magazine
Un job programat care interoghează singur magazinele și actualizează `latest_version` în `app_versions`:

- **Edge function `check-store-versions`** (rulează zilnic prin pg_cron):
  - iOS: Apple iTunes Lookup API (`itunes.apple.com/lookup?bundleId=com.evenimentecncv.app`) — API public oficial, returnează versiunea curentă din App Store.
  - Android: pagina publică Play Store (`play.google.com/store/apps/details?id=com.evenimentecncv.app`) — versiunea se extrage din HTML; dacă extragerea eșuează, păstrăm valoarea existentă (Play Store nu are API public simplu).
  - Scrie `latest_version` (și `store_url` pentru siguranță) în `app_versions` pentru fiecare platformă.
- **Cron zilnic** (dimineața, ora 06:00 București, alături de celelalte joburi existente).

### 3. Cartonașul reacționează la versiunea din magazin
- Acum cartonașul apare doar când versiunea instalată < `min_version` (setată manual).
- Schimbăm logica: cartonașul apare când versiunea instalată < `latest_version` (adică există o versiune mai nouă în magazin) — complet automat, fără intervenție manuală.
- `min_version` rămâne pentru cazuri critice: dacă instalată < `min_version`, cartonașul devine **neînchidbîl** (fără butonul ×), forțând actualizarea pentru versiuni cu probleme grave.

## Detalii tehnice

- Migrare SQL: cron job nou prin pg_cron care apelează edge functionul (la fel ca joburile existente de notificări/email).
- Edge function `check-store-versions`: fetch iTunes Lookup + pagina Play Store, parse versiune, UPDATE pe `app_versions` cu service role.
- `src/lib/app-version.ts`: `needsUpdate()` compară cu `latest_version`; nou flag `forced` când instalată < `min_version`.
- `UpdateAvailableCard.tsx`: butonul × ascuns în modul `forced`; text diferit pentru actualizare obligatorie („Această versiune nu mai este acceptată. Actualizează pentru a continua.").
- Verificare: rulare manuală a funcției → `latest_version` iOS devine 1.27 (sau mai nou); simulare versiune veche → cartonașul apare.

## Notă

Versiunea afișată acum în App Store este 1.27, iar noi suntem la 1.28 — deci utilizatorii cu 1.27 vor vedea cartonașul imediat ce 1.28 ajunge în magazine și jobul o detectează.
