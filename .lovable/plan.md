# Modul „Concursuri” – evidența premiilor

## Ce construim
1. **Modul nou „Concursuri”** în pagina Module (profesori, diriginți, CSE, admin, manager).
2. **Admin – Administrare concursuri**: adaugă / editează / dezactivează concursuri, fiecare legat de o catedră.
   - Catedre fixe: Matematică, Limba română, Engleză, Franceză, Informatică, Geografie, Istorie, Fizică, Chimie, Religie, Arte, Științe umaniste.
3. **Profesor – Adaugă premiu** (formular cu buton de închidere, un câmp pe rând pe mobil):
   - Catedra → Concursul (filtrat după catedră) → Etapa (Locală, Sector, Municipiu, Națională, Internațională) → Premiul (Locul 1, Locul 2, Locul 3, Mențiune, Aur, Argint, Bronz, Diplomă de participare) → Elevii (căutare cu diacritice).
   - Numărul de premii = numărul elevilor selectați (un rând per elev).
   - Profesorul care adaugă e salvat automat ca **profesor coordonator**.
   - Anul școlar se completează automat.
4. **„Premiile mele”**: profesorul își vede, editează și șterge propriile premii.
5. **Rapoarte de sfârșit de an** (admin, manager, CSE): filtre pe an școlar, catedră, concurs, etapă, premiu, clasă, profesor; totaluri pe catedră/premiu/etapă și listă detaliată (Nume Prenume, clasa, concurs, etapă, premiu, profesor); export PDF și CSV.
6. Elevii nu au acces la modul (deocamdată).

## Detalii tehnice
- Tabele: `competitions` (nume, catedră, activ), `competition_awards` (competition_id, student_id, teacher_id = auth.uid(), etapa, premiu, academic_year, created_at). Catedre, etape, premii ca enum-uri.
- RLS: concursurile – citire pentru autentificați, scriere doar admin; premii – profesorul gestionează doar rândurile proprii, admin/manager/CSE citesc tot. GRANT-uri pentru authenticated/service_role.
- Înregistrare în `src/modules/registry.ts`, rute noi pentru profesor, admin și rapoarte; încărcare paginată (`.range()`) în rapoarte; export prin `report-pdf.ts`.
- Test pentru regula „număr premii = elevi selectați” și pentru totalurile din raport.
