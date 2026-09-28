# Distribuire automată a elevilor sub minim (diriginți)

## Ce se schimbă
În raportul dirigintelui, fila „Sumar", apare butonul **„Distribuie automat elevii sub minim"** pentru sesiunea selectată.

1. Aplicația ia fiecare elev al clasei care are ore rezervate sub minimul regulii.
2. Pentru fiecare elev alege la întâmplare evenimente la care poate participa efectiv: interne, viitoare, din sesiune, deschise clasei sau anului lui, cu locuri libere și fără suprapuneri cu rezervările lui sau cu alte evenimente propuse în aceeași distribuire.
3. Adaugă evenimente până când elevul atinge minimul. Minimul poate fi depășit dacă evenimentul nu se potrivește exact.
4. Locurile libere sunt împărțite corect între elevi: nu propune mai mulți elevi decât locurile rămase.
5. **Previzualizare**: o fereastră arată, pe fiecare elev, evenimentele propuse și orele „înainte → după". Există butoanele „Refă distribuirea" (o nouă variantă aleatoare) și „Confirmă".
6. La confirmare, fiecare înscriere trece prin aceeași verificare securizată ca înscrierea individuală. Elevul primește bilet și notificare. La final apare un rezumat: câte înscrieri au reușit și câte au eșuat, cu motivul.
7. Elevii pentru care nu se găsesc destule evenimente sunt marcați „Minim neatins — nu mai sunt evenimente disponibile".

## Detalii tehnice
- Datele candidaților vin din `list_enrollable_events_for_student` (pentru fiecare elev sub minim), care are deja filtrele de eligibilitate, suprapunere și locuri libere.
- Algoritmul rulează în client: elevii sunt amestecați aleator, iar evenimentele fiecărui elev la fel. Aplicația ține local locurile rămase pe fiecare eveniment și intervalele deja alocate fiecărui elev, ca să evite suprapunerile din propunere.
- Confirmarea apelează secvențial `manually_enroll_event_student` prin `enrollStudent` (securitate, notificări și audit există deja). Erorile sunt colectate, nu opresc restul.
- Componentă nouă `HomeroomAutoDistributeDialog` în `src/components/teacher/`, legată în `TeacherReportsPage`. După confirmare se reîncarcă sumarul.
- Fără modificări în baza de date.
