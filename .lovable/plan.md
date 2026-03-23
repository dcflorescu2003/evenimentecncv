

## Plan: Editare și ștergere evenimente din pagina de detalii

### Situația actuală

Profesorii și diriginții **pot deja** edita și șterge evenimentele din lista de evenimente (`/prof/events`) — butoanele Pencil și Trash2 există. RLS-ul permite UPDATE și DELETE pe evenimentele proprii.

Ce **lipsește**: pe pagina de detalii a evenimentului (`/prof/events/:id`) nu există butoane de editare sau ștergere. Utilizatorul trebuie să se întoarcă la listă pentru aceste acțiuni.

### Ce se adaugă

**`src/pages/prof/ProfEventDetailPage.tsx`**
- Adaug butoane "Editează" și "Șterge" lângă butonul "Scanează" din header-ul paginii de detalii
- Butonul "Editează" navighează înapoi la `/prof/events` și deschide dialogul de editare, SAU (mai simplu) redirecționează la lista de evenimente cu un query param care declanșează editarea
- **Varianta mai bună**: adaug direct dialogul de editare în pagina de detalii (refolosind logica din `ProfEventsPage`) — dar asta ar duplica mult cod
- **Varianta recomandată**: butoanele de Editează și Șterge direct pe pagina de detalii, cu:
  - Dialog de confirmare pentru ștergere (cu redirect la `/prof/events` după succes)
  - Dialog de editare cu formularul complet (extras ca și în ProfEventsPage)
- Butonul "Șterge" deschide un AlertDialog de confirmare, apoi navighează la `/prof/events`

### Fișiere afectate

| Tip | Fișier |
|-----|--------|
| Editat | `src/pages/prof/ProfEventDetailPage.tsx` — butoane Edit + Delete + dialoguri |

