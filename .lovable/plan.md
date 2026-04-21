

## Plan: Email obligatoriu + Tab „Contact" pentru evenimente publice

### 1. Email obligatoriu la rezervare publică (sub 10 bilete)

**`src/pages/public/PublicEventBookingPage.tsx`**
- Schimb label-ul de la „Email (opțional)" la „Email *"
- Adaug validare client-side: dacă `guestEmail` e gol, afișez toast de eroare și opresc submit-ul
- Mut câmpul de telefon să apară mereu (nu doar la 10+ bilete), dar rămâne opțional sub 10

**`supabase/functions/public-book-event/index.ts`**
- Adaug validare server-side: emailul devine obligatoriu pentru toate rezervările (nu doar 10+)
- Validez formatul email cu regex simplu
- Păstrez telefonul obligatoriu doar la 10+ bilete (cum e acum)

### 2. Tab „Contact" în pagina de detalii eveniment admin

**`src/pages/admin/EventDetailPage.tsx`**
- Adaug un nou `TabsTrigger` cu valoarea „contact", vizibil doar dacă evenimentul este public (`event.is_public`)
- Label: `Contact ({publicParticipants.length})`
- Query-ul existent `publicParticipants` include deja `guest_name`, `guest_email`, `guest_phone` și `public_tickets(*)` — nu e nevoie de query nou
- Conținutul tab-ului: un tabel cu coloanele:
  - **Nume** — `guest_name`
  - **Email** — `guest_email` (cu link `mailto:`)
  - **Telefon** — `guest_phone` (sau „—")
  - **Locuri rezervate** — numărul de bilete non-cancelled din `public_tickets`
- Afișez mesaj „Nicio rezervare publică" dacă lista e goală

### Fișiere modificate
- `src/pages/public/PublicEventBookingPage.tsx` — email obligatoriu + validare
- `supabase/functions/public-book-event/index.ts` — validare server email obligatoriu
- `src/pages/admin/EventDetailPage.tsx` — tab nou „Contact"

### Ce NU se schimbă
- Schema DB (emailul e deja stocat în `public_reservations.guest_email`)
- RLS policies
- Alte pagini (prof, coordinator)

