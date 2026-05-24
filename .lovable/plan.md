## Problemă

Pe `/student/orar` apare „Niciun meniu disponibil pentru zilele următoare." deși API-ul `https://flashcantemir.onrender.com/api/menu` întoarce date. Cauza: în `CantinaMenuSection.tsx` filtrăm strict `i.date >= todayISO`, iar API-ul nu are intrări pentru ziua curentă / viitoare (ultima intrare e 22.05.2026, azi 24.05.2026 — weekend, cantina nu a publicat încă meniul săptămânii viitoare).

## Soluție

Modific `src/components/schedule/CantinaMenuSection.tsx`:

1. **Schimb logica de filtrare**: dacă există intrări pentru azi sau viitor → le arăt pe acelea (max 7 zile înainte). Dacă nu există → fallback la ultimele 1–2 zile disponibile (cele mai recente date din API), cu un mic indicator vizual „Ultimul meniu publicat" pentru a fi clar că nu e meniul de azi.
2. **Mesaj gol doar dacă API-ul nu returnează absolut nimic.**
3. Limita la maximum 5 zile afișate, sortate cronologic.

## Detalii tehnice

```text
dates = items.map(i => i.date) unique, sorted asc
future = dates.filter(d => d >= todayISO)
display = future.length > 0 ? future.slice(0, 5)
                            : dates.slice(-2)   // ultimele 2 zile disponibile
showStaleHint = future.length === 0 && display.length > 0
```

Restul randării rămâne identic; doar adaug un badge mic „Ultimul meniu publicat" deasupra grilei când `showStaleHint`.

Nu modific edge function-ul `get-cantina-menu` — cache-ul și fetch-ul funcționează corect.

## Fișiere modificate

- `src/components/schedule/CantinaMenuSection.tsx`
