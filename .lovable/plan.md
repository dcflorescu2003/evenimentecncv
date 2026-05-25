## Vizualizare pe zile în orar

Adăugăm la `StudentSchedulePage.tsx` un comutator între două moduri de vizualizare:

1. **Săptămână** (curent) — tabel cu toate zilele.
2. **Zi** — o singură zi afișată, cu butoane `‹ Ziua anterioară` / `Ziua următoare ›` și indicator (Luni / Marți / ...).

### UI

- Sus, în header-ul cardului „Orarul clasei", două butoane (sau `Tabs`): `Săptămână` | `Zi`.
- În modul Zi:
  - Bară de navigație: `‹`  **Luni**  `›` (centrat), cu numele zilei curente.
  - Listă verticală a orelor (similar cu varianta mobile actuală), evidențiind ora curentă dacă e azi.
  - Default: ziua de azi dacă e Lu–Vi, altfel Luni.
  - Navigarea ciclică Lu↔Vi (nu sare în weekend).
- Pe mobile, tab-urile L/Ma/Mi/J/V existente rămân ca atare (modul Zi e implicit oricum pe mobile, comutatorul Săptămână/Zi poate fi ascuns sub `md`).

### Implementare

- State nou `viewMode: "week" | "day"` și `selectedDay: number` (1–5).
- Refactor minim: extragem randarea unei zile (lista de ore) într-un helper local, reutilizat de varianta mobile actuală și de noul mod Zi pe desktop.
- Fără modificări de logică / DB / API. Doar prezentare.

### Fișiere

- `src/pages/student/StudentSchedulePage.tsx` — singura modificare.
