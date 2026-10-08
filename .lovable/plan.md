# Normă incompletă — Elevi: filtru pe clase + ore rezervate corecte

## Problema cu orele rezervate
Raportul cere dintr-o singură bucată rezervările, biletele, profilurile și elevii asistenți pentru aproape 1000 de elevi. Baza de date întoarce cel mult 1000 de rânduri pe cerere, iar lista lungă de elevi poate face cererea prea mare. Așa se pierd rezervări și unii elevi apar cu mai puține ore rezervate sau validate decât au de fapt.

## Ce se schimbă
1. **Ore corecte:** toate citirile (elevi din clase, rezervări, bilete, asistenți, profiluri, evenimente) se fac pe bucăți, cu paginare, folosind același mecanism deja folosit în fila Profesori. Rezervările se citesc doar pentru evenimentele sesiunii, deci cererea este mai mică și mai precisă.
2. **Filtru pe clase** în fila Elevi: o listă „Toate clasele” / clasă anume, ordonată V–XII. Tabelul, versiunea de mobil și exportul PDF arată doar clasa aleasă (titlul PDF include clasa).
3. Plafonul de 4 ore pe zi rămâne aplicat.

## Verificare
Compar pentru câțiva elevi din clase diferite totalurile din raport cu un calcul direct în baza de date.

## Detalii tehnice
- `src/pages/manager/IncompleteNormPage.tsx`: în query-ul de elevi se înlocuiesc `.in(...)` neîmpărțite cu `fetchInChunks`; rezervările se filtrează pe `event_id` din sesiune.
- Se adaugă starea `classFilter` și un `Select`; `filteredStudents` este folosit pentru randare și export.
