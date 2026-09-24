# Smart Lab — rezervări doar profesori/diriginți, orar pentru voluntari

## Ce se schimbă

**Cine poate rezerva**

- Doar profesorii și diriginții (plus adminul, care gestionează tot) pot face, modifica sau anula rezervări.
- Conturile CSE, asistent și manager nu mai au buton de rezervare (managerul poate doar vedea calendarul).

**Elevii voluntari**

- Văd același calendar săptămânal cu toate echipamentele rezervate din școală (doar vizualizare, fără rezervare).
- Rezervările pentru clasa lor apar evidențiate (culoare burgundy + eticheta „Clasa ta"); celelalte apar estompate, cu ora și sala.
- Sub calendar rămâne lista rezervărilor viitoare ale clasei, cu butonul „Echipament pregătit".

**Notificări**

- La fiecare rezervare nouă (și la modificare/anulare) voluntarii clasei primesc notificare în aplicație și push — funcționalitate existentă, verificată că pornește și din noul flux.

**Ceilalți elevi**

- Nu văd modulul Smart Lab în listă și nu pot deschide pagina (comportament deja existent, verificat).

## Detalii tehnice

- Regula de inserare pe `vr_reservations` restrânsă la `admin`, `teacher`, `homeroom_teacher` (eliminare `cse`, `coordinator_teacher`).
- `SmartLabPage.tsx`: `canBook` = admin/teacher/homeroom_teacher; ramura pentru voluntari afișează grila săptămânală (aceeași interogare pe toate rezervările) cu evidențiere pe `class_id` din `vr_volunteers`, plus lista existentă.
- `notify-vr-reservation`: verificare suplimentară că apelantul e proprietarul rezervării sau admin.  
  
Lasam si conturile CSE si manager sa faca rezervari.  
  
Si fa si un bump de versiune