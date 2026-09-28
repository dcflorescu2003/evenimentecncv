# Clasele V–VIII în rapoarte și formulare

## Ce am găsit
- În baza de date clasele V, VI, VII, VIII sunt active, cu 115 elevi. Au și câteva rezervări.
- **Raport pe clase** (manager): clasele sunt încărcate, dar sunt puse în ordine alfabetică. Așa, „V–VIII” ajung între „IX G” și „X A”, în mijlocul listei, și nu se văd ușor. La fel se întâmplă în lista de alegere a clasei și în PDF.
- **Rapoarte admin** (lista de clase): aceeași ordonare alfabetică.
- **Formularul de eveniment pentru CSE** („Ani eligibili”): are doar anii IX–XII. Elevii de la V–VIII nu pot fi aleși ca an eligibil, deci nu văd acele evenimente.
- Nu am găsit reguli în baza de date care să excludă clasele V–VIII. Pagina de clase din admin le arată corect, în fila de gimnaziu.

## Ce schimb
1. **Raport pe clase:** ordonez clasele după an, apoi după literă: V, VI, VII, VIII, IX A…XII G. Ordinea e aceeași în listă, în lista de alegere și în PDF.
2. **Rapoarte admin:** aceeași ordonare în lista de alegere a clasei.
3. **Alte liste de clase** (alegerea claselor eligibile la cluburi și voluntariat, pagina de credențiale): aceeași ordonare, ca V–VIII să apară primele.
4. **„Ani eligibili” la CSE** (formularul de creare și cel de editare a evenimentului): adaug anii V, VI, VII și VIII lângă IX–XII.

## Verificare
- Deschid raportul pe clase și verific că V–VIII apar primele, cu numărul corect de elevi: 28, 30, 28, 29.
- Verific că exportul PDF le conține.

## Detalii tehnice
- `ClassReportPage.tsx`, `ReportsPage.tsx`, `ClassEligibilityPicker.tsx`, `CredentialsPage.tsx`: înlocuiesc `.order("display_name")` cu `.order("grade_number").order("section", { nullsFirst: true })` și selectez `grade_number`.
- `ProfEventsPage.tsx` și `ProfEventDetailPage.tsx`: `[5..12]` cu etichete romane (V–XII) în loc de `[9,10,11,12]`.
- Nu schimb nimic în baza de date.
