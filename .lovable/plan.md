# Încărcare mai rapidă a codurilor QR

## Ce încetinește acum
- **Biletele la evenimente:** lista biletelor e citită direct din tabele, cu toate regulile de securitate verificate pe aproape 3.000 de rezervări (aceeași cauză ca eroarea de la bifarea prezenței). Pe rețele slabe, QR-ul apare după câteva secunde sau deloc.
- **Legitimația:** la fiecare deschidere ecranul așteaptă serverul înainte să arate ceva, iar codul nou se cere abia când cel vechi e aproape expirat, deci uneori apare un gol.

## Modificări
1. **Bilete: citire rapidă pe server**
   - O funcție nouă care întoarce direct biletele elevului conectat (doar ale lui), cu evenimentul atașat, fără verificările lente.
   - Pagina „Biletele mele” și detaliul evenimentului o folosesc în locul citirii directe.
2. **Bilete: afișare instantă din memoria telefonului**
   - Ultima listă de bilete se păstrează pe dispozitiv și apare imediat la deschidere (și fără internet), apoi se actualizează în fundal.
3. **Legitimație: fără goluri între coduri**
   - Codul nou se cere din timp (înainte să expire cel curent), cu reîncercare automată rapidă dacă rețeaua cade.
   - La revenirea în aplicație, codul încă valabil rămâne afișat până sosește cel nou.
   - Curățarea codurilor vechi se face o dată pe zi (job programat), nu la fiecare generare.
4. Desenarea QR-ului rămâne la fel (culoare, logo); regulile de prezență nu se schimbă.

## Verificare
- Măsor timpul de răspuns al funcțiilor noi pe date reale.
- Deschid ca elev biletele și legitimația, inclusiv cu rețeaua oprită după prima încărcare.

## Detalii tehnice
- RPC `get_my_tickets()` SECURITY DEFINER, filtrat pe `auth.uid()`, returnează rezervări + `tickets` + `events`.
- Cache cu `localStorage` per utilizator (cheie cu user id), golit la deconectare.
- Badge: refresh la `expires_at - 7s`, retry cu backoff 1s/2s/4s; `DELETE` din `issue_student_qr` mutat într-un job pg_cron zilnic.
- Pe telefoane e nevoie de o versiune nouă a aplicației.
