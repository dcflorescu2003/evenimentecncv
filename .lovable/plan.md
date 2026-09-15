# Fișier XML model pentru importul tuturor claselor

## Ce fac

Creez un fișier XML model (`/mnt/documents/model-orar-2-clase.xml`) cu 2 clase (V A și IX C), compatibil cu dialogul „Import XML — toate clasele". Fișierul poate fi descărcat și folosit direct pentru testare.

## Format (confirmat din cod)

- Fiecare clasă are o etichetă `<P>Clasa V A</P>` urmată de un `<Table>` cu orarul.
- Tabelul are 5 rânduri (zile): `Lu`, `Ma`, `Mi`, `Jo`, `Vi` (în `<TH>`).
- Fiecare rând are TD-uri: primul = ora 1, al doilea = coloană fantomă (gol, ignorată), apoi orele 2–7.
- Celulele au formatul: `Materie Sala InițialeProf` (ex. `Mate 5 RC` = Matematică, sala 5, prof. RC).
- Materiile sunt automat expandate din aliasuri (Mate → Matematică, L.rom → Limba română etc.).

## Conținut fișier

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Document>
  <P>Clasa V A</P>
  <Table>
    <TR><TH>Lu</TH><TD>Mate 5 RC</TD><TD></TD><TD>L.rom 5 GL</TD><TD>Geo 5 MN</TD><TD>Info AEL DC</TD><TD>Ef sport MN</TD><TD>Le 5 AB</TD><TD>Dirig 5 GL</TD></TR>
    <TR><TH>Ma</TH><TD>L.rom 5 GL</TD><TD></TD><TD>Mate 5 RC</TD><TD>Ist 5 BV</TD><TD>Bio 5 ST</TD><TD>Rel 5 PO</TD><TD>Le 5 AB</TD><TD>Em 5 MU</TD></TR>
    <TR><TH>Mi</TH><TD>Mate 5 RC</TD><TD></TD><TD>L.rom 5 GL</TD><TD>Info AEL DC</TD><TD>Geo 5 MN</TD><TD>Ef sport MN</TD><TD>Ep 5 PL</TD><TD>Le 5 AB</TD></TR>
    <TR><TH>Jo</TH><TD>L.rom 5 GL</TD><TD></TD><TD>Mate 5 RC</TD><TD>Bio 5 ST</TD><TD>Ist 5 BV</TD><TD>Rel 5 PO</TD><TD>Le 5 AB</TD><TD>Dirig 5 GL</TD></TR>
    <TR><TH>Vi</TH><TD>Mate 5 RC</TD><TD></TD><TD>L.rom 5 GL</TD><TD>Geo 5 MN</TD><TD>Info AEL DC</TD><TD>Ef sport MN</TD><TD>Em 5 MU</TD><TD>Le 5 AB</TD></TR>
  </Table>
  <P>Clasa IX C</P>
  <Table>
    <TR><TH>Lu</TH><TD>Mate 12 RC</TD><TD></TD><TD>L.rom 12 GL</TD><TD>Fiz 12 BV</TD><TD>Info AEL DC</TD><TD>Chim 12 ST</TD><TD>Le 12 AB</TD><TD>Dirig 12 GL</TD></TR>
    <TR><TH>Ma</TH><TD>L.rom 12 GL</TD><TD></TD><TD>Mate 12 RC</TD><TD>Bio 12 ST</TD><TD>Ist 12 BV</TD><TD>Geo 12 MN</TD><TD>Le 12 AB</TD><TD>Ef sport MN</TD></TR>
    <TR><TH>Mi</TH><TD>Mate 12 RC</TD><TD></TD><TD>Fiz 12 BV</TD><TD>Info AEL DC</TD><TD>Chim 12 ST</TD><TD>L.rom 12 GL</TD><TD>Le 12 AB</TD><TD>Dirig 12 GL</TD></TR>
    <TR><TH>Jo</TH><TD>L.rom 12 GL</TD><TD></TD><TD>Mate 12 RC</TD><TD>Bio 12 ST</TD><TD>Ist 12 BV</TD><TD>Geo 12 MN</TD><TD>Le 12 AB</TD><TD>Ef sport MN</TD></TR>
    <TR><TH>Vi</TH><TD>Mate 12 RC</TD><TD></TD><TD>L.rom 12 GL</TD><TD>Info AEL DC</TD><TD>Fiz 12 BV</TD><TD>Chim 12 ST</TD><TD>Em 12 MU</TD><TD>Le 12 AB</TD></TR>
  </Table>
</Document>
```

## Notă

- „Fiz" și „Chim" nu sunt în aliasuri (rămân neschimbute la import). Restul materiilor sunt expandate automat (Mate → Matematică, L.rom → Limba română, Info AEL → Informatică AEL etc.).
- Pentru a funcționa cu importul bulk, în baza de date trebuie să existe clase cu `grade_number=5 section=A` și `grade_number=9 section=C`.
