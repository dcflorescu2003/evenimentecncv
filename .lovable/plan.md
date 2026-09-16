# Smart Lab — rezervări echipamente VR

Modul nou „Smart Lab" în hubul de aplicații, pentru rezervarea echipamentelor VR de către profesori, cu voluntari elevi care pregătesc echipamentul.

## Ce va putea face fiecare

**Profesorul**
- Vede calendarul rezervărilor (zi / săptămână) și sloturile libere.
- Face o rezervare alegând: data, ora de start (07:30, 08:30, ... până la 18:30), clasa, sala și materialele VR dorite (unul sau mai multe).
- Își poate edita sau anula propriile rezervări.

**Regula de disponibilitate**: o singură rezervare pe interval orar, la nivel de școală. Un slot deja ocupat apare gri, cu numele profesorului și sala, și nu mai poate fi selectat.

**Sălile**: Sala 1 … Sala 12, Lab. bio, Lab. chimie, Lab. fizică, Amfiteatru.

**Voluntarii (elevi)**
- Secțiune separată „Voluntari", organizată pe toate clasele existente în aplicație.
- Tu (admin) alegi elevii voluntari din lista elevilor fiecărei clase.
- Când un profesor face o rezervare pentru o clasă, voluntarii acelei clase primesc automat notificare (în aplicație + push, ca la restul modulelor) cu data, ora, sala și materialele de pregătit. Notificare și la modificarea/anularea rezervării.
- Voluntarul vede în Smart Lab lista rezervărilor viitoare ale clasei sale și poate marca „Echipament pregătit".

**Catalogul de materiale**
- Se încarcă tot catalogul din fișierul trimis: 1939 materiale, pe materii (Istorie, Biologie, Chimie, Geografie, Fizică), cu imagine de previzualizare, tip (model 3D / video), dimensiune și link.
- În formularul de rezervare: căutare după denumire + filtrare pe materie, grilă cu imagini și bifare multiplă; materialele alese apar ca listă în rezervare și în notificarea voluntarilor.

## Acces
- Modulul e vizibil tuturor profesorilor (inclusiv diriginți, CSE) și elevilor care sunt voluntari; adminul are acces complet.
- Adminul vede toate rezervările, poate anula orice rezervare și gestionează voluntarii.

## Detalii tehnice

Bază de date (migrare, cu GRANT + RLS pe fiecare tabel nou):
- `vr_materials` — subject, name, media_type, size_label, preview_url, track_url, track_id. Citire pentru `authenticated`; scriere doar admin. Populat prin import din fișierul .xlsx (inserări pe loturi).
- `vr_rooms` — lista fixă de săli (12 săli + 3 laboratoare + amfiteatru), cu ordine de afișare.
- `vr_reservations` — date, start_time, class_id, room_id, teacher_id, notes, status (`active` / `cancelled`), prepared_at, prepared_by. Index unic parțial pe `(date, start_time) WHERE status='active'` — garantează o singură rezervare per interval.
- `vr_reservation_materials` — legătură rezervare ↔ material.
- `vr_volunteers` — class_id, student_id, assigned_by, unic pe pereche.
- RLS: profesorii gestionează propriile rezervări, citesc toate rezervările; adminii tot; elevii voluntari citesc rezervările clasei lor și pot actualiza doar `prepared_at`/`prepared_by`. Funcții `security definer`: `is_vr_volunteer(_user_id, _class_id)`, `vr_check_slot(_date, _start_time)`.
- Notificări: inserare în `notifications` + apel `send-push-to-user` (funcție existentă) pentru fiecare voluntar al clasei, printr-o edge function nouă `notify-vr-reservation`; rutare adăugată în `src/lib/notification-routing.ts`.

Frontend:
- `src/modules/registry.ts`: modul nou `smartlab` (icon Headset) cu căile `/smartlab` pentru profesori/admin și `/smartlab` pentru elevi voluntari (conținut diferit după rol).
- `src/components/layouts/SmartLabLayout.tsx` + rute în `App.tsx`: `/smartlab` (calendar + rezervările mele), `/smartlab/new`, `/smartlab/:id`, `/smartlab/volunteers` (admin).
- Componente noi: `VrCalendar` (grilă zile × ore 07:30–18:30), `VrReservationDialog` (dată, oră, clasă, sală, materiale), `VrMaterialPicker` (căutare + filtre + grilă imagini, paginare), `VrVolunteersPage` (listă clase → selecție elevi cu Combobox căutabil).
- Ore generate din 07:30 la 18:30, pas de 60 minute; format 24h, date zz.ll.aaaa cu `DateInput`; interfață integral în română.

## Etape
1. Migrare bază de date + import catalog materiale + săli.
2. Modul, layout, rute, calendar și formular de rezervare cu selecție materiale.
3. Secțiunea Voluntari (admin) + vizualizarea pentru elevii voluntari.
4. Notificări automate la creare / modificare / anulare rezervare.
