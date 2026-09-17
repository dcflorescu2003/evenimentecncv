# Ștergere pentru elementele arhivate / încheiate

Adminul va putea șterge definitiv cluburile arhivate și proiectele de voluntariat finalizate, direct din lista de Cluburi și Voluntariat.

## Ce se schimbă

- **Cluburi arhivate**: în lista de cluburi apare butonul „Șterge" pe cardurile cu statusul „Arhivat" (vizibil doar pentru admin).
- **Voluntariat finalizat**: același buton pe proiectele cu statusul „Finalizat" (la voluntariat nu există „arhivat", echivalentul este „Finalizat"/închis).
- Confirmarea avertizează clar că se șterg și înscrierile, întâlnirile/zilele, prezența și coordonatorii asociați, iar acțiunea este definitivă.
- Ciornele rămân ștergibile ca până acum (de către creator/admin).

## Ce există deja și rămâne neschimbat

- **Evenimente închise/anulate**: butonul „Șterge" există deja în Evenimente (admin), pentru orice status.
- **Formulare de feedback închise**: butonul „Șterge" există deja în lista de formulare, pentru orice status.
- **Sesiuni**: ștergerea există deja în pagina Sesiuni.

Dacă vrei, la evenimente și feedback pot restrânge ștergerea doar la cele închise/anulate — momentan le las cum sunt.

## Detalii tehnice

1. `src/components/clubs/ClubsVolunteerHub.tsx`:
   - `DeleteDraftButton` devine generic (`DeleteEntityButton`) cu props pentru titlul și textul confirmării („Ciornă" vs „Club arhivat" / „Proiect finalizat").
   - Condiții de afișare: `status === "draft"` (ca acum, pentru creator/admin) sau `isAdmin && (c.status === "archived")` pentru cluburi, respectiv `isAdmin && p.status === "closed"` pentru voluntariat.
   - Se folosește rolul de admin deja disponibil în pagină (`useAuth`), fără interogări noi.
2. Fără migrări: politicile RLS existente („Admins manage clubs", „Admins manage volunteer projects") permit deja ștergerea de către admin, iar cheile externe au `ON DELETE CASCADE` pentru înscrieri, întâlniri, zile, coordonatori, asistenți, departamente și întrebările formularului — deci ștergerea nu eșuează.
