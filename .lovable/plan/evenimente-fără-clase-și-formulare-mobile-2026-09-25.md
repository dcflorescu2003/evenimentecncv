# Evenimente fără clase și formulare mobile

## Rezultat
- Un eveniment intern fără nicio clasă și fără niciun an eligibil nu va apărea elevilor și nu va putea fi deschis direct de ei.
- Evenimentul rămâne vizibil tuturor profesorilor, diriginților, coordonatorilor, managerilor și administratorilor.
- Profesorul organizator și coordonatorii desemnați vor putea căuta și înscrie manual elevi la eveniment.
- Elevii adăugați manual vor vedea evenimentul și biletul lor, chiar dacă evenimentul nu are clase selectate.
- Pe telefon, fiecare câmp din formularele de creare și editare a evenimentelor va ocupa un rând complet; pe ecrane mai mari se păstrează aranjarea compactă pe două coloane.

## Modificări

### 1. Vizibilitate corectă pentru elevi
- Actualizez regulile de acces astfel încât elevii să poată citi un eveniment intern publicat sau încheiat numai dacă:
  - clasa lor este selectată;
  - anul lor este selectat;
  - sunt deja înscriși manual;
  - sunt desemnați asistenți la eveniment.
- Evenimentele publice pentru vizitatori rămân neschimbate.
- Păstrez accesul complet pentru rolurile didactice și administrative.
- Aplic aceeași regulă în lista de evenimente, calendarul elevului și pagina de detalii, ca accesul printr-un link direct să nu ocolească filtrarea.
- Schimb mesajul din formular din „Nicio selecție = toate clasele” în „Nicio selecție = eveniment ascuns elevilor; participanții se adaugă manual”.

### 2. Înscriere manuală de către organizator și coordonatori
- Adaug o operație securizată pentru înscrierea manuală, care verifică pe server că persoana este administrator, creatorul evenimentului sau coordonator desemnat.
- Operația va crea ori reactiva rezervarea și biletul elevului, fără să transforme evenimentul într-unul vizibil tuturor elevilor.
- Păstrez verificările pentru capacitate, rezervări duplicate și suprapuneri; selecția claselor și perioada publică de înscriere nu vor bloca adăugarea manuală de către echipa evenimentului.
- Adaug în pagina coordonatorului butonul „Adaugă elev”, cu o căutare rapidă după nume și clasă.
- Folosesc aceeași operație și în paginile organizatorului și administratorului, pentru comportament și drepturi consecvente.
- După înscriere, elevul primește biletul și notificarea existentă.

### 3. Formulare ușor de completat pe mobil
- Uniformizez formularele de creare/editare din zona administratorului și profesorului, inclusiv editarea din pagina evenimentului.
- Pe mobil: titlu, sesiune, dată, ore, locație, sală, capacitate, limită pe clasă, status și fiecare câmp al perioadei de înscriere vor fi afișate pe rânduri separate.
- Fereastra va avea margini sigure, înălțime derulabilă și butoane accesibile fără deplasare orizontală.
- Pe tabletă și desktop, câmpurile scurte vor reveni la două coloane.

## Verificare
- Testez cu un eveniment publicat fără clase/ani: invizibil pentru un elev neînscris, vizibil pentru profesori.
- Testez deschiderea directă a adresei evenimentului din contul elevului.
- Testez înscrierea unui elev de către organizator și de către un coordonator, apoi confirm apariția biletului în contul elevului.
- Confirm că o persoană fără drepturi nu poate folosi înscrierea manuală.
- Verific formularele la lățimi de telefon de 320 px și 390 px, precum și pe desktop.

## Detalii tehnice
- Va fi necesară o migrare pentru regulile de acces și operația securizată de înscriere; aceasta va păstra accesul minim necesar și va evita expunerea datelor elevilor.
- Nu schimb structura evenimentelor și nu modific evenimentele existente; noua interpretare se aplică automat celor fără clase/ani selectați.
