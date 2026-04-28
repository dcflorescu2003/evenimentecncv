## Problema

Pe mobil, header-ul cu logo "CNCV" se mișcă la scroll și ajunge să se suprapună peste status bar-ul nativ (ceas, baterie, semnal). Cauza:

1. Header-ul folosește `sticky top-0`. Pe iOS Safari (și Chrome Android), când utilizatorul face scroll, bara de URL se restrânge și `env(safe-area-inset-top)` se recalculează la o valoare mai mică, făcând header-ul să "urce" peste zona de status.
2. În plus, `sticky` nu garantează că elementul rămâne fix dacă părintele (`flex min-h-screen flex-col`) nu se comportă cum trebuie pe toate browserele mobile, mai ales în PWA / Capacitor pe iOS.

Captura de ecran confirmă: după scroll, "CNCV" și clopoțelul intră peste "23:17" și iconițele de sistem.

## Soluție

Schimb header-ul din `sticky` în `fixed` pe mobil și mă asigur că `padding-top` rezervă **întotdeauna** spațiul corect pentru status bar, indiferent de starea browser-ului.

### Modificări

**1. `src/index.css` — clasa `.header-safe`**

Garantez un minim de safe-area chiar și când `env(safe-area-inset-top)` raportează 0 (browser cu bară restrânsă):

```css
.header-safe {
  padding-top: max(env(safe-area-inset-top), 0px);
}
```

Adaug o nouă utilitate `.h-header-safe` pentru spacer-ul de sub headerul fixed:

```css
.h-header-safe {
  height: calc(3.5rem + env(safe-area-inset-top));
}
```

(3.5rem = h-14 = înălțimea header-ului)

**2. Toate cele 6 layouts** (`StudentLayout`, `ProfLayout`, `TeacherLayout`, `CoordinatorLayout`, `ManagerLayout`, `AdminLayout`):

- Schimb `sticky top-0` → `fixed top-0 left-0 right-0`
- Cresc `z-index` la `z-40` (peste conținut, sub modale)
- Adaug un `<div className="h-header-safe" />` spacer imediat sub header pentru a împinge conținutul în jos cu exact înălțimea ocupată de header (inclusiv safe-area)
- Pentru `StudentLayout`, păstrez `pb-safe-nav` pe `<main>` (nav-ul de jos e deja fixed)

### Detaliu tehnic — de ce `fixed` în loc de `sticky`

Cu `fixed`, header-ul e ancorat de viewport, nu de containerul scrollabil. Asta îl face imun la:
- Restrângerea barei de URL pe iOS Safari
- Schimbările dinamice ale `env(safe-area-inset-top)` la scroll
- Comportament inconsistent al `sticky` în interiorul `flex` containers pe iOS

Spacer-ul `.h-header-safe` ocupă exact spațiul vizual pe care l-ar fi ocupat header-ul în flux normal, deci layout-ul nu se schimbă.

## Fișiere modificate

- `src/index.css` — actualizez `.header-safe`, adaug `.h-header-safe`
- `src/components/layouts/StudentLayout.tsx`
- `src/components/layouts/ProfLayout.tsx`
- `src/components/layouts/TeacherLayout.tsx`
- `src/components/layouts/CoordinatorLayout.tsx`
- `src/components/layouts/ManagerLayout.tsx`
- `src/components/layouts/AdminLayout.tsx`

Pentru `AdminLayout` și `ManagerLayout` (care au sidebar), aplic `fixed` doar pe mobil dacă structura sidebar o cere — verific la implementare și păstrez comportamentul desktop intact.