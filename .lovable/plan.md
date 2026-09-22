# API pentru aplicația cantinei — identificarea elevului prin legitimație

## Ce vrem să obținem

Aplicația cantinei folosește aceiași elevi ca aplicația noastră. Ea trebuie să poată:
1. importa (și ține la zi) lista elevilor, cu același identificator unic ca la noi;
2. scana legitimația digitală a unui elev și să afle instant despre cine e vorba, ca să lege comanda de elev.

Pentru asta construim un „punct de legătură" (API) cu cheie de acces, folosit doar de aplicația cantinei.

## Cum va funcționa

### 1. Cheie de acces
- Generăm o cheie secretă pe care i-o dai elevului care a făcut aplicația. Fără ea, nimeni nu poate folosi API-ul.
- Cheia se poate schimba oricând, fără modificări în aplicația noastră.

### 2. Importul elevilor
- Aplicația cantinei cere lista elevilor și primește, pentru fiecare: identificatorul unic, numele, prenumele și clasa.
- Lista se poate cere pe bucăți (pentru toți cei ~950 de elevi) și poate fi cerută periodic pentru a prelua elevii noi sau schimbările de clasă.

### 3. Scanarea legitimației
- Elevul deschide „Legitimația mea"; codul se schimbă la fiecare 20 de secunde, ca acum.
- Aplicația cantinei scanează codul și îl trimite către API.
- Răspunsul: identificatorul unic al elevului, numele complet și clasa — exact ce e nevoie ca să lege comanda de elev.
- Codul rămâne valabil după scanarea la cantină, deci aceeași legitimație poate fi folosită în continuare la cluburi și voluntariat.
- Dacă codul e expirat sau nevalid, răspunsul spune clar motivul, în română.

### 4. Ce nu se schimbă
- Legitimația elevului, prezența la cluburi și voluntariat rămân exact cum sunt acum.
- Aplicația cantinei nu poate citi sau modifica nimic altceva din baza noastră: doar lista de elevi și rezultatul scanării.

## Detalii tehnice

Funcție edge nouă `canteen-api` (`verify_jwt = false`, autentificare proprie prin antet `x-api-key` comparat cu secretul `CANTEEN_API_KEY`, comparație în timp constant), cu două acțiuni:

- `POST /canteen-api/students?limit=&offset=` → listă paginată din `profiles` filtrată pe rolul `student` (`user_roles`), cu clasa curentă din `student_class_assignments` + `classes.display_name`. Câmpuri returnate: `id`, `first_name`, `last_name`, `display_name`, `class`. Fără email (nu a fost cerut).
- `POST /canteen-api/resolve-badge` cu body `{ "qr": "CNCV-STU2:..." }` → apelează o funcție SQL nouă `resolve_student_badge_public(_qr text)` (security definer) care refolosește `resolve_student_qr` fără a marca `used_at`, și întoarce `{ ok, student_id, first_name, last_name, display_name, class }` sau `{ ok: false, message }`.

Note:
- `resolve_student_qr` rămâne neschimbată; nu marcăm tokenul folosit, deci prezența la cluburi/voluntariat nu e afectată.
- Funcția edge folosește service role intern; niciun GRANT nou pentru `anon`.
- CORS activ, ca aplicația cantinei să poată apela și din browser.
- Validare body cu Zod; 401 la cheie lipsă/greșită, 400 la body invalid.
- Opțional (inclus): tabel `canteen_api_log` (`id`, `action`, `student_id`, `ok`, `created_at`) pentru urmărirea apelurilor, doar admin poate citi.
- Documentație scurtă pentru elevul dezvoltator, salvată ca `docs/canteen-api.md` (endpointuri, exemple curl, mesaje de eroare).

## Ce îți trebuie de la tine
Nimic acum. După implementare îți dau cheia de acces și documentația, pe care le trimiți elevului care a construit aplicația cantinei.
