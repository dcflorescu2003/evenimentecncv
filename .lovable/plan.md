# Istoric restrâns peste tot

Toate secțiunile de istoric din aplicație vor fi închise implicit. Utilizatorul vede doar un rând cu titlul, numărul de elemente și o săgeată; la click, lista se desfășoară. La fiecare reîncărcare a paginii istoricul revine închis.

## Cum va arăta

```text
> Istoric (12)
```
După click:
```text
v Istoric (12)
   [card] ...
   [card] ...
```

## Unde se aplică

- Biletele elevului — secțiunea „Istoric”
- Panoul profesorului — „Istoric coordonare”
- Panoul asistentului/coordonatorului — „Încheiate”
- Feedback elev/profesor — „Istoric”
- Cluburi & voluntariat (elev) — „Istoricul participărilor”
- Board Picker (Portofoliu) — „Istoric”

## Detalii tehnice

- Componentă nouă `src/components/CollapsibleSection.tsx` pe baza `@/components/ui/collapsible`: primește `title`, `count`, `children`; randează un buton cap-de-secțiune cu titlu, `(count)` și `ChevronDown` rotit la deschidere; `defaultOpen` fals, fără persistare.
- Înlocuiește antetele `<h2>` + lista din: `src/pages/student/StudentTicketsPage.tsx`, `src/pages/prof/ProfDashboard.tsx`, `src/pages/coordinator/CoordinatorDashboard.tsx`, `src/pages/feedback/StudentFeedbackPage.tsx`, `src/components/clubs/StudentClubsPage.tsx`, `src/pages/portfolio/BoardPickerPage.tsx`.
- Numai prezentare: nicio schimbare de interogări, permisiuni sau logică de date.
