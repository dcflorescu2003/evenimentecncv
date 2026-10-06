# Reparare conectare iuliana.boss

## Cauza (confirmată)
La conectare, aplicația caută contul după numele de utilizator. Contul Iulianei Serba are numele de utilizator **iuliana.boss**, dar adresa internă de conectare a rămas **iulian.boss**. Parola s-a resetat corect, dar conectarea cu „iuliana.boss” nu găsește contul. Momentan ar merge doar cu „iulian.boss”.

Același lucru se întâmplă la un singur alt cont: **l.letitiamaria.geanametea** (elevă din clasa a V-a, redenumită mai devreme). Aceasta ar merge acum doar cu „m.metealetitiamaria.geana”.

## Ce fac
1. Pentru ambele conturi, aliniez adresa internă de conectare la numele de utilizator afișat. Parola rămâne aceeași (cea resetată acum, respectiv Cncv1234#).
2. Verific apoi că nu mai există niciun cont cu nepotrivire (rezultatul trebuie să fie 0).
3. Adaug o regulă în baza de date: dacă numele de utilizator se schimbă direct în baza de date, adresa de conectare se actualizează automat. Așa nu se mai poate repeta problema.

## Detalii tehnice
- `auth.users.email` → `<profiles.username>@school.local` pentru cele 2 id-uri, prin funcția de admin (`auth.admin.updateUserById`, email_confirm: true), nu prin SQL în schema auth.
- Prevenție: în loc de trigger pe auth (interzis), funcția edge `admin-manage-users` deja sincronizează la editare; adaug un trigger pe `profiles` care blochează schimbarea `username` din afara funcției de admin când emailul nu corespunde (sau o verificare care o raportează), ca să nu mai apară nepotriviri silențioase.
