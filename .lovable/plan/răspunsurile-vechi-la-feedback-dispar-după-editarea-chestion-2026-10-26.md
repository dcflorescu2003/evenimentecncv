# Răspunsurile vechi la feedback dispar după editarea chestionarului

## Ce s-a întâmplat (verificat)

Chestionarul „Orele de info” are 7 răspunsuri. Primele 4 (18:20–18:53, 25.10) nu mai au niciun răspuns la întrebări; ultimele 3 (după 20:03) sunt complete.
La 19:51 chestionarul a fost editat și salvat. La salvare, aplicația șterge toate întrebările și le creează din nou — iar ștergerea unei întrebări șterge automat și răspunsurile la ea. Așa s-au pierdut răspunsurile primelor 4 respondenți.

Răspunsurile acelea nu mai pot fi recuperate din aplicație (doar dintr-o copie de rezervă a bazei de date).

## Ce reparăm

1. La salvarea unui chestionar, întrebările existente se actualizează pe loc (text, opțiuni, ordine), nu se mai șterg și recreează. Răspunsurile rămân legate de ele.
2. Ștergerea unei întrebări care are deja răspunsuri e blocată de baza de date; în editor apare mesajul: „Întrebarea are deja răspunsuri și nu poate fi ștearsă.”
3. Dacă chestionarul are deja răspunsuri, editorul afișează un avertisment că modificarea opțiunilor poate face rezultatele vechi greu de interpretat.
4. În raport, răspunsurile fără niciun conținut nu mai apar ca respondenți goi (cele 4 pierdute nu vor mai umfla numărul).

## Detalii tehnice

- `FeedbackEditorPage.tsx`: înlocuiește `delete().eq("form_id")` + `insert` cu update pentru întrebările cu id existent, insert pentru cele noi, delete doar pentru cele eliminate.
- Migrare: FK `feedback_answers.question_id` din `ON DELETE CASCADE` în `ON DELETE RESTRICT`.
- `FeedbackReportPage.tsx`: filtrează răspunsurile cu `answers.length === 0`.
- Test: salvarea unui chestionar editat nu șterge întrebările existente.

&nbsp;

&nbsp;