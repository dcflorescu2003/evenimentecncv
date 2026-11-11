# Profesori de serviciu în modulul Orar

## Ce se construiește

1. **Tabel „Profesori de serviciu"** în modulul Orar, vizibil doar pentru profesori și diriginți (și admin). Arată săptămâna curentă (Luni–Vineri, cu datele calculate automat), 2 profesori dimineața și 2 după-amiaza, plus săptămâna următoare. Profesorul logat își vede tura evidențiată.
2. **Ciclu de 2 săptămâni (A/B)**: se definesc o singură dată săptămâna A și săptămâna B; datele se schimbă automat, ciclul continuă și în vacanțe. Săptămâna A pornește de la 09.11.2026.
3. **Interfață de editare**: grilă Săpt. A / Săpt. B × zile × tură × 2 locuri; fiecare loc se alege prin căutare printre profesorii și diriginții din aplicație. Fără excepții pe date.
4. **Acces la editare**: în pagina admin Utilizatori, o bifă „Poate edita profesorii de serviciu". Adminul are acces mereu.
5. **Import inițial** din tabelul trimis (cele 40 de nume), potrivite cu conturile; numele care nu se potrivesc le raportez ca să fie alese manual.

## Detalii tehnice

- Tabel `duty_schedule` (week_slot A/B, weekday 1–5, shift morning/afternoon, position 1–2, teacher_id → profiles), unic pe (week_slot, weekday, shift, position).
- Permisiune editare prin `module_access` (cheie `duty_editor`) sau tabel dedicat, verificată cu funcție security definer `can_edit_duty_schedule`; RLS: citire pentru teacher/homeroom_teacher/admin, scriere doar pentru editori.
- Săptămâna curentă = paritatea (săptămâni de la 09.11.2026), în fusul Europe/Bucharest; logică în `src/lib/duty-schedule.ts` cu teste.  
  
Sa faci si un buton "schimba A-B" care inverseaza ciclul