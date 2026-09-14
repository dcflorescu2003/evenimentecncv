# Plan: Îmbunătățiri vizuale legitimație elev (QR)

## Scop
Modificări vizuale pe `src/pages/student/StudentBadgePage.tsx` pentru QR-ul rotativ al legitimației elevului.

## Modificări

### 1. QR colorat cu logo CNCV în centru
- Import logo: `import cncvLogo from "@/assets/cncv-logo.jpg"`.
- `<QRCodeSVG>` primește `fgColor="#7A1F2E"` (burgundy, culoarea brandului) în loc de negru implicit.
- Logo CNCV încorporat în centrul QR-ului prin `imageSettings={{ src: cncvLogo, height: 44, width: 44, excavate: true }}` — `excavate` lasă spațiu alb în jurul logo-ului pentru lizibilitate.
- Nivel de corecție ridicat la `"H"` (High) pentru a compensa zona ocupată de logo (mai multă redundanță).

### 2. Eliminat textul „Cod nou în Xs"
- Linia `<p className="font-medium">{expired ? "Cod expirat" : `Cod nou în ${secondsLeft}s`}</p>` — ștearsă.
- Rămâne doar cercul de progres (SVG inel). Când codul e expirat, inelul se golește complet (progres 0) și sub cerc apare doar butonul „Generează cod nou".

### 3. Buton „Generează acum" → „Generează cod nou"
- Textul butonului schimbat din `Generează acum` în `Generează cod nou`.

### 4. Text instrucțiune jos schimbat
- Din: `Codul se schimbă automat. Arată-l coordonatorului la club sau la voluntariat pentru a-ți marca prezența.`
- În: `Codul se schimbă automat. Arată codul coordonatorului la club sau la voluntariat pentru a-ți marca prezența.`

## Layout rezultat cerc + buton
```text
   [ inel progres SVG ]
   [ Generează cod nou ]   ← link sub cerc
```

## Fișiere modificate
- `src/pages/student/StudentBadgePage.tsx` — singurul fișier atins

## Verificare
- Build OK (verific `build-errors.log` după editare).
