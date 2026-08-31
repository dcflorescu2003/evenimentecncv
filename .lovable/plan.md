# Ridicarea restricției pe coloana `profiles.email`

## Context
Aplicația nu folosește emailuri reale pentru conturi: autentificarea se face cu `username@school.local`, iar coloana `profiles.email` este goală pentru toți cei 780 de utilizatori. Restricția de coloană (introdusă la remedierea finding-urilor de securitate) a cauzat eroarea „0 utilizatori" pe aplicația mobilă, care cerea `select("*")`. Utilizatorul a decis ridicarea restricției.

## Pași

1. **Migrație bază de date**
   - `GRANT SELECT (email) ON public.profiles TO authenticated;` — redă accesul de citire la coloana `email` pentru utilizatorii autentificați.
   - `anon` rămâne fără acces la `profiles` (neschimbat).
   - Funcția `get_profile_emails` rămâne disponibilă, dar nu mai e singura cale de acces.

2. **Simplificare cod (opțional, recomandat pentru consistență)**
   - `src/pages/admin/UsersPage.tsx`: revenire la `select("*")` pe `profiles` și eliminarea tipului `Omit<Tables<"profiles">, "email">`, acum că coloana e din nou citibilă — previne divergențe viitoare web vs mobil.
   - Verificare `rg` pentru alte interogări cu liste explicite de coloane pe `profiles` care au ocolit restricția (ex. `useAuth.tsx` — rămâne neschimbat, e deja corect).

3. **Verificare**
   - Test `curl` cu cheie anon + token autentificat: `profiles?select=email` returnează 200 pentru `authenticated`, 403 pentru `anon`.
   - Verificare în preview că pagina de utilizatori din admin afișează lista completă.

## Note tehnice
- Restricția era implementată prin `REVOKE SELECT (email)` la nivel de coloană; migrația doar re-adaugă grant-ul, fără să atingă politicile RLS existente.
- Mobile: build-ul 1.22 rămâne necesar doar dacă codul mobil încarcă altceva blocat; după această migrație chiar și build-urile vechi cu `select("*")` pe `profiles` vor funcționa din nou.
