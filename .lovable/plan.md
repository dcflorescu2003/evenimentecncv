# Diplome de voluntariat pentru participanți

## Ce primește coordonatorul
- Pe pagina unui proiect de voluntariat apare butonul „Diplome”. Îl văd organizatorul, coordonatorii și adminul, dar nu și elevii asistenți.
- Butonul deschide o listă cu participanții înscriși. Fiecare rând are:
  - numele elevului;
  - orele de voluntariat calculate automat;
  - o căsuță de bifat.
- Orele se calculează adunând durata zilelor de voluntariat la care elevul a fost marcat „Prezent” sau „Întârziat”. Orele pot fi corectate manual pentru fiecare elev înainte de printare.
- Butoane „Selectează toți” / „Doar cei cu ore”. Elevii cu 0 ore sunt debifați implicit.
- „Descarcă diplomele (PDF)” creează un singur PDF A4 landscape, cu o pagină pentru fiecare elev bifat, gata de printat.

## Cum arată diploma
- Arată identic cu modelul trimis: siglă, „DIPLOMĂ DE VOLUNTARIAT”, formele grafice din dreapta, semnătura directorului Dogaru Gheorghe și „Nr. reg.” cu spații goale de completat de mână.
- Se completează automat:
  - numele elevului, cu MAJUSCULE, pe linia de sub „Acordată domnișoarei/domnului”, sub forma NUME PRENUME;
  - textul: „În semn de apreciere pentru activitatea și implicarea de care a dat dovadă în organizarea și desfășurarea evenimentului „NUMELE PROIECTULUI”, cumulând un număr de N ore de voluntariat.” Pentru 1 oră se scrie „o oră”, la singular.
- Diacriticele se păstrează corect.

## Detalii tehnice
- Fundalul diplomei se obține din PDF-ul trimis: pagina se transformă într-o imagine la rezoluție mare. Numele lipsă și paragraful cu „NUME EVENIMENT” și „[X]” se șterg (acoperite cu alb), apoi imaginea se salvează în aplicație. Linia pentru nume, siglele, grafica și semnătura rămân.
- Generarea se face cu jsPDF (deja în proiect), A4 landscape, 297×210 mm. Fundalul ocupă toată pagina. Textul se scrie peste, cu fontul cu diacritice folosit deja în rapoartele PDF și cu culorile din model (negru pentru text, visiniu pentru nume).
- Datele vin din înscrierile, zilele și prezențele proiectului, citite paginat. Durata unei zile este diferența dintre ora de sfârșit și ora de început, rotunjită la cea mai apropiată oră întreagă, conform regulii de rotunjire existente.
- Componentă nouă `VolunteerDiplomasDialog`, integrată în `VolunteerProjectDetailPage.tsx`, lângă butoanele de export.
- Diplomele se verifică vizual: se generează un PDF de test, care se transformă în imagini și se inspectează.
