
## Plan: Sortare evenimente de la cel mai apropiat la cel mai îndepărtat

### Problema
- Query-ul curent folosește `.order("date", { ascending: true })` → cele mai vechi date primele
- Pentru viitoare, vrem cel mai apropiat de azi primul, nu cel mai îndepărtat

### Soluție
Schimb ordinea în query și aplic sortare explicită pe fiecare categorie (viitoare vs trecute) pentru UX optim:

1. **Modific `StudentEventsPage.tsx`:**
   - Schimb query-ul să folosească `.order("date", { ascending: false })` (descendent)
   - Sortez explicit array-urile `upcoming` și `past` înainte de render:
     - `upcoming`: sortare ascendentă (cel mai apropiat → cel mai departe)
     - `past`: sortare descendentă (cel mai recent → cel mai vechi)

### Cod modificat (liniile 81-93 și 375-385)

```typescript
// Query - schimbat în descending
const { data: events = [], isLoading } = useQuery({
  queryKey: ["published_events"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "published")
      .eq("published", true)
      .order("date", { ascending: false }); // ← schimbat din true în false
    if (error) throw error;
    return data as Event[];
  },
});

// În render, sortare explicită pentru fiecare categorie:
const upcoming = filtered
  .filter((ev) => !isEventPast(ev))
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // ↑ apropiat → departe

const past = filtered
  .filter((ev) => isEventPast(ev))
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // ↓ recent → vechi
```

### Ce se schimbă
- **Viitoare**: ordine cronologică naturală (azi → mâine → săptămâna viitoare)
- **Trecute**: ordine inversă (ieri → săptămâna trecută → acum 2 luni)

### Ce NU se schimbă
- Logica de filtrare, RLS, rezervări
- Structura UI (secțiunile „Disponibile" și „Desfășurate")
- Paginile din alte roluri (profesor, admin, coordonator)
