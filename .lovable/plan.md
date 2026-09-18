# Format 24 de ore în toată aplicația

## Obiectiv

Toate orele introduse sau afișate vor folosi formatul `HH:MM`, cu ore de la `00` la `23`, fără AM/PM, atât pe web, cât și în aplicațiile mobile.

## Implementare

1. **Câmp comun pentru oră**
   - Creez un control reutilizabil `TimeInput`, similar controlului existent pentru dată.
   - Introducerea va accepta și normaliza numai valori `00:00–23:59`, va afișa permanent modelul `HH:MM` și nu va depinde de selectorul nativ al telefonului/browserului, care poate afișa AM/PM.
   - Păstrez validarea existentă și adaug stările necesare pentru câmpuri obligatorii sau opționale.

2. **Evenimente**
   - Folosesc același control în formularele de creare/editare pentru administratori și profesori: ora de început, ora de sfârșit și orele perioadei de înscriere.
   - Datele existente rămân neschimbate; se schimbă doar modul de introducere și afișare.

3. **Cluburi și voluntariat**
   - Înlocuiesc controalele native care pot afișa AM/PM pentru întâlniri, zile de voluntariat și perioadele de înscriere.
   - Câmpurile combinate dată-oră din configurarea clubului vor deveni dată în format `zz.ll.aaaa` plus oră `HH:MM`, păstrând aceeași valoare salvată.

4. **Afișare consecventă**
   - Centralizez formatarea orelor și a datelor cu oră în fusul `Europe/Bucharest` și forțez ciclul de 24 de ore.
   - Actualizez afișările care folosesc formatarea locală directă, inclusiv previzualizări, detalii, rapoarte și documente exportate, astfel încât să nu poată apărea AM/PM.
   - Smart Lab își păstrează intervalele fixe existente (`07:30`, `08:30` etc.).

## Verificare

- Testez valorile-limită `00:00` și `23:59`, valorile invalide și ordinea început–sfârșit.
- Verific creare și editare pentru evenimente, cluburi și voluntariat pe desktop și mobil.
- Confirm că toate orele salvate anterior se deschid și se afișează corect, fără modificări de bază de date.
