# Optimizare suplimentară a scanării QR

## Probleme confirmate

- Configurația video comună suprascrie alegerea `camera din spate`: biblioteca ignoră `facingMode` sau camera selectată atunci când primește separat `videoConstraints`.
- Limitarea la formatul QR este transmisă la pornirea camerei, deși biblioteca o citește la crearea scannerului; optimizarea anterioară nu este aplicată efectiv.
- La evenimente, camera este oprită complet după fiecare cod, apoi recreată după salvare și încă 500 ms. Această repornire produce cea mai mare întârziere dintre două scanări.
- Implementarea este duplicată în paginile admin, profesor, coordonator și elev, ceea ce poate produce comportamente diferite.

## Modificări

1. **Alegerea sigură a camerei din spate**
   - Elimin constrângerea care suprascrie selecția camerei.
   - Aleg automat o cameră din spate dintre dispozitivele disponibile, cu fallback la `facingMode: environment`.
   - Păstrez un selector vizibil pentru schimbarea camerei și memorez alegerea pe telefon.
   - Etichetez clar opțiunile „Camera spate” și „Camera față” când denumirile dispozitivului permit identificarea.

2. **Decodare QR realmente optimizată**
   - Mut `QR_CODE only` în configurația corectă, la crearea scannerului.
   - Păstrez dezactivarea imaginii oglindite numai pentru camera din spate; pentru camera frontală permit oglindirea.
   - Folosesc o zonă de scanare adaptată dimensiunii imaginii, nu un pătrat fix prea mic.
   - Păstrez motorul nativ de detectare atunci când telefonul îl oferă.

3. **Fără oprirea camerei după fiecare scanare**
   - În paginile de evenimente, pun temporar pe pauză doar citirea cadrelor cât timp se validează codul.
   - Reiau citirea imediat după salvare, fără închiderea și redeschiderea fluxului video și fără pauza fixă de 500 ms.
   - Blochez același cod pentru scurt timp, astfel încât să nu fie înregistrat de două ori.
   - Camera se oprește complet doar la ieșirea din pagină, schimbarea filei sau schimbarea camerei.

4. **Comportament comun în toate zonele**
   - Aplic aceeași selecție și aceeași configurație în scanarea pentru evenimente, cluburi și voluntariat.
   - Păstrez neschimbate regulile de prezență, mesajele și alternativa de introducere manuală.

## Verificare

- Verific alegerea implicită și schimbarea camerei față/spate.
- Verific scanări consecutive și protecția împotriva dublării.
- Verific permisiunea refuzată, lipsa camerelor și revenirea după un cod invalid.
- Rulez testele și compilarea, apoi verific interfața în format de telefon.

## Notă pentru aplicația mobilă

După modificare, proiectul trebuie actualizat local și sincronizat cu aplicația nativă prin `npx cap sync`, apoi trebuie creat un build nou pentru testarea pe telefon.
