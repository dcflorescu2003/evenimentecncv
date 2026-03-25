

## Plan: Modificări rapoarte manager + setare minim participanți pe sesiune

### Ce se va face

**1. "Ore organizate" = doar evenimente încheiate cu cel puțin un bilet scanat**
In toate rapoartele manager pentru profesori (TeacherReportPage, IncompleteNormPage tab profesori, DayReportPage, SessionReportPage), orele organizate se vor calcula doar pentru evenimentele care:
- Au data trecută (event.date < today)
- Au cel puțin un bilet cu status "present" sau "late" (din tabela `tickets`)
- Dacă sesiunea are `min_participants` setat, evenimentul trebuie să aibă cel puțin acel număr de bilete scanate

**2. Normă incompletă — sortare și navigare**
- Tab profesori: sortare după nume de familie (`.sort((a,b) => a.name.localeCompare(b.name))` — `name` e deja `last_name first_name`)
- Butonul "Detalii" din TeacherReportPage: când vine din `/manager/incomplete`, butonul "Înapoi" va naviga la `/manager/incomplete` în loc de lista de profesori
- Tab elevi: la fel, butonul va duce la `/manager/incomplete`

**3. Normă incompletă — buton "Detalii" în loc de link**
Înlocuire `<button className="text-primary underline...">` cu `<Button variant="link" size="sm">Detalii</Button>` (identic cu TeacherReportPage)

**4. Raport clase — vizualizare toate clasele (fără selecție)**
Când nu e selectată o clasă, se afișează un raport cu toate clasele sortate, fiecare clasă având lista cronologică de evenimente la care participă elevii din acea clasă + numărul de elevi din clasa respectivă. Exportabil ca PDF.

**5. Setare opțională "Număr minim participanți" pe sesiune (Admin)**
- Migrare DB: adăugare coloană `min_participants integer nullable` pe tabela `program_sessions`
- SessionsPage.tsx (admin): adăugare câmp opțional în formularul de creare/editare sesiune
- Logica din rapoartele manager: când calculează dacă un eveniment e "desfășurat", verifică și dacă are >= min_participants bilete scanate

### Detalii tehnice

**Migrare SQL:**
```sql
ALTER TABLE public.program_sessions 
ADD COLUMN min_participants integer DEFAULT NULL;
```

**Fișiere modificate:**
- `supabase/migrations/` — migrare nouă pentru `min_participants`
- `src/pages/admin/SessionsPage.tsx` — câmp opțional în dialog
- `src/pages/manager/TeacherReportPage.tsx` — filtrare "ore organizate" doar pentru evenimente desfășurate; buton "Înapoi" condiționat de origin
- `src/pages/manager/IncompleteNormPage.tsx` — sortare profesori alfabetic, buton Detalii, navigare la TeacherReportPage cu `?id=X&from=incomplete`
- `src/pages/manager/DayReportPage.tsx` — ore profesori = doar din evenimente desfășurate
- `src/pages/manager/SessionReportPage.tsx` — fără modificări de ore (nu afișează ore profesori)
- `src/pages/manager/ClassReportPage.tsx` — raport toate clasele când nu e selectată una

**Logica "eveniment desfășurat":**
Se va crea o funcție helper reutilizabilă care, primind lista de evenimente din sesiune + tickets + min_participants opțional, returnează setul de event IDs considerate desfășurate. Aceasta va fi folosită în TeacherReportPage, IncompleteNormPage și DayReportPage.

