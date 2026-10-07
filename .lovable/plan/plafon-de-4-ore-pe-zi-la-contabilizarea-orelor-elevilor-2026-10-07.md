# Plafon de 4 ore pe zi la contabilizarea orelor elevilor

## Ce se schimbă
- Elevii se pot înscrie în continuare la oricâte evenimente într-o zi (nicio restricție nouă la înscriere).
- La **totalurile raportate**, fiecare zi contează maximum **4 ore** per elev. Exemplu: luni 10h de evenimente → se contabilizează 4h; marți 3h → 3h; total 7h.
- Regula se aplică separat pentru:
  - ore rezervate (din rezervările active ale zilei, plafonate la 4h);
  - ore validate (doar prezent/întârziat/asistent din ziua respectivă, plafonate la 4h).
- Unde se vede: dashboard și pagini elev (progres față de minim), raportul diriginților (rezervate/minim, validate/minim, elevi sub minim, distribuire automată, înscriere individuală), rapoartele managerului/admin pe elev, clasă, sesiune, zi, normă incompletă (fila elevi), plus PDF/export-urile lor.
- Lista de evenimente rămâne completă; în detaliile elevului, zilele care depășesc 4h primesc o mică notă „contabilizate 4h din Xh”.
- Distribuirea automată a diriginților ține cont de plafon: nu mai propune evenimente într-o zi în care elevul are deja 4h, pentru că nu l-ar ajuta să atingă minimul.
- Orele evenimentelor pentru profesori (normă, planificate/realizate) nu se schimbă.
- Limita maximă de ore pe sesiune (dacă e setată) se compară tot cu orele plafonate.

## Detalii tehnice
- Funcție nouă comună în `src/lib/student-hours.ts`: primește lista de (dată, ore) per elev și întoarce totalul cu `min(4, sumă zi)` pe fiecare zi; constantă `DAILY_HOURS_CAP = 4`. Toate paginile care adună `counted_duration_hours` pentru elevi o folosesc în loc de suma simplă.
- Migrare: `get_student_progress` și verificarea `max_hours` din `check_booking_eligibility`/`manually_enroll_event_student` adună pe zi cu `LEAST(4, sum)` înainte de total.
- Aplicațiile mobile: necesită un build nou pentru ca ecranele elevului să arate totalurile plafonate (web se actualizează la publicare).
