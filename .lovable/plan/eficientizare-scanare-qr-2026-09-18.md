# Eficientizare scanare QR

## Obiectiv

Scanarea codurilor QR (prezență evenimente, legitimații cluburi/voluntariat) să fie vizibil mai rapidă, fără schimbări de logică sau riscuri pentru aplicație.

## Ce încetinește acum scanarea

1. Scannerul încearcă să decodeze **toate** formatele de coduri de bare (nu doar QR) și verifică și imaginea oglindită — dublă/triplă muncă pe fiecare cadru.
2. Frecvența de analiză e 10 cadre/secundă, deci un cod stă în fața camerei în medie ~100 ms până e citit.
3. După fiecare cod, scannerul se blochează complet pe durata apelului către server **plus** o pauză fixă de 1,5 s — la rând de elevi, fiecare scanare costă 2–3 secunde.
4. Cele 4 pagini de scanare (admin, profesor, coordonator, elev) au fiecare propria copie a configurației — orice îmbunătățire trebuie aplicată în 5 locuri.

## Modificări

### 1. Configurație comună, mai rapidă (în `QrCameraScanner.tsx` + cele 4 pagini de scanare)

- `formatsToSupport: [QR_CODE]` — doar coduri QR.
- `disableFlip: true` — sare peste decodarea oglindită (~2× mai rapid per cadru).
- `fps: 10 → 20` — cu optimizările de mai sus, costul pe cadru scade, deci ne permitem dublarea frecvenței.
- `aspectRatio` și constrângeri video 1280×720 „ideal" — cadru mai mic de procesat, focus mai bun.

### 2. Flux continuu la scanări în rând

- Înlocuirea blocării globale cu o **pauză per cod**: același text citit repetat e ignorat 2 s, dar un cod **diferit** (elevul următor) este acceptat imediat ce precedentul a fost trimis.
- Reducerea pauzei implicite `pauseMs` 1500 → 800 ms.
- Rezultat practic: la scanarea unui rând de elevi, timpul per elev scade de la ~2–3 s la sub 1 s.

### 3. Fără alte schimbări

- Logica de server (RPC-urile de prezență), QR-ul rotativ, mesajele de eroare și UI-ul rămân neschimbate.

## Fișiere atinse

- `src/components/scan/QrCameraScanner.tsx` — config + pauză per cod
- `src/pages/admin/AdminScanPage.tsx`, `src/pages/prof/ProfScanPage.tsx`, `src/pages/coordinator/ScanPage.tsx`, `src/pages/student/StudentScanPage.tsx` — aceeași configurație de scanner

## Verificare

- Build + typecheck.
- Test în preview: scanare repetată aceluiași cod (nu dublează), scanare a două coduri diferite la rând (al doilea trece imediat), confirmare că prezența se marchează corect.  
