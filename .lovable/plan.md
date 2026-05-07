# Sub-tab "Cerere" în Dosar — pentru contul CSE

## Ce se schimbă

În pagina de detalii eveniment (`ProfEventDetailPage.tsx`), pentru utilizatorii cu rol **CSE**, tab-ul existent **"Dosar / Cerere"** va conține două sub-taburi:

1. **Dosar** — exact conținutul actual (lista de documente încărcate + buton upload).
2. **Cerere** — nou. Conține o cerere oficială editabilă, pre-completată cu datele evenimentului, plus buton **"Export PDF"**.

Pentru rolurile non-CSE, tab-ul rămâne neschimbat (doar Dosar).

## Conținutul cererii (editabil)

Textul reproduce documentul atașat. Câmpurile **bold** sunt pre-completate automat din evenimentul curent, dar rămân editabile:

```
R.N.E.B.                                                  Nr. ___

                                              APROB,
                                              DOGARU GHEORGHE
                                              DIRECTOR

                          C E R E R E

Stimate Domnule Director,

Biroul Executiv al Consiliului Școlar al Elevilor din Colegiul
Național „Cantemir-Vodă", vă adresează prezenta cerere prin care
se solicită aprobarea organizării în cadrul colegiului nostru a
unui eveniment cu titlul «{TITLU EVENIMENT}».

Propunerea este ca evenimentul să aibă loc în data de {DATA},
ora {ORA}, locația fiind {LOCAȚIE}. Prezenți vor fi elevii care
s-au înscris la eveniment prin intermediul platformei de
evenimente CNCV.

Asigurându-vă de întreaga noastră considerație,
Președintele Consiliului Școlar al Elevilor Colegiului Național
„Cantemir-Vodă",
{NUME PREȘEDINTE}
```

Câmpuri editabile separate (input-uri), pentru a evita probleme de formatare și a păstra bold-ul corect în PDF:
- Număr înregistrare (R.N.E.B. Nr.)
- Numele directorului (default: "DOGARU GHEORGHE")
- Titlu eveniment (default: `event.title`)
- Data (default: data evenimentului, format `zz.ll.aaaa`)
- Ora (default: `HH:MM`)
- Locația (default: `event.location`)
- Numele președintelui CSE (default: `display_name` al utilizatorului curent)

Restul textului rămâne fix (afișat read-only în UI), pentru a păstra forma oficială.

## Export PDF

Buton **"Export PDF"** generează un PDF A4 portrait cu:
- **Antet**: cele două logouri pe un singur rând — **Consiliul Elevilor** (stânga) și **CNCV** (dreapta), cu o linie separator dedesubt.
- Conținutul cererii cu marcajele bold păstrate pentru titlu, dată, oră, locație și numele evenimentului.
- Font implicit jsPDF + `stripDiacritics` (consistent cu `report-pdf.ts`).
- Numele fișierului: `Cerere_{titlu_event}_{data}.pdf`.
- Descărcare prin `downloadFileMobileSafe` (compatibil mobil).

## Detalii tehnice

**Fișiere modificate:**
- `src/pages/prof/ProfEventDetailPage.tsx` — adaugă sub-Tabs în `TabsContent value="dossier"` (doar dacă `isCse`). Componenta nouă inline pentru formularul cererii.
- `public/cerere-header/consiliul-elevilor.png` — logo Consiliul Elevilor (din `user-uploads://Picture1.png`).
- `public/cerere-header/cncv.png` — logo CNCV (din `user-uploads://Picture2.png`).

**Generare PDF:** folosim `jsPDF` (deja instalat). Logourile sunt încărcate ca `dataURL` (fetch + FileReader) și inserate prin `doc.addImage` în antet la coordonate fixe (~25mm înălțime, alinate stânga/dreapta cu margini de 15mm). Textul cererii este randat cu `doc.text` + `splitTextToSize` pentru wrap. Cuvintele bold sunt randate separat cu `doc.setFont("helvetica","bold")` în linie cu restul (calculând offset-ul cu `getTextWidth`).

**Persistență:** câmpurile sunt locale în component state (nu salvate în DB) — se resetează la valorile prefilled la fiecare deschidere. Dacă vrei să le salvăm pentru a fi păstrate între sesiuni, spune-mi și adaug o tabelă/coloană dedicată.

## Întrebare rapidă

Vrei ca cererea generată să fie și **salvată automat în Dosar** după export PDF (uploadată în `event_dossier`), sau doar descărcată local pe dispozitiv?
