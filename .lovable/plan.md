# Fix: legitimația afișează „fără internet” din cauza unei erori de bază de date

## Problema (confirmată din jurnalul de rețea al preview-ului)

Apelul `issue_student_qr` întoarce eroarea:

```text
function gen_random_bytes(integer) does not exist  (SQLSTATE 42883)
```

Funcția `gen_random_bytes` face parte din extensia `pgcrypto`, care nu este instalată în baza de date. Pagina de legitimație tratează orice eroare ca „offline”, de aceea apare mesajul „Reconectează-te pentru a genera un cod nou” deși internetul funcționează.

## Modificări

1. **Migrare nouă** în `supabase/migrations/`:
   - `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`
   - Refacere `issue_student_qr()` cu `SET search_path = public, extensions` (funcția are `search_path = public`, deci nu ar găsi `gen_random_bytes` din schema `extensions` fără această ajustare).
   - Verificare: apel de test al funcției după migrare.

2. **Îmbunătățire mesaj în `src/pages/student/StudentBadgePage.tsx`** (mică):
   - Distinct între lipsa reală a conexiunii (`navigator.onLine` / eroare de rețea) și erorile de server, ca un mesaj precis să apară data viitoare în loc de „offline” (ex. „Codul nu a putut fi generat. Reîncearcă.”).

## Rezultat așteptat

Pagina „Legitimația mea” generează codul QR rotativ corect, cu inelul de numărătoare inversă funcțional.

## Detalii tehnice

- Fișier nou: `supabase/migrations/<timestamp>_enable_pgcrypto_fix_issue_student_qr.sql`
- Fișier modificat: `src/pages/student/StudentBadgePage.tsx`
- Fără modificări de RLS sau alte funcții atinse.
