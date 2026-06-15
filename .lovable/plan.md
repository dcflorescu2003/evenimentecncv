## Modificare UI — `src/components/layouts/PortfolioLayout.tsx`

Bara de navigație din modulul Portofoliu va fi împărțită pe **două rânduri**:

**Rândul 1** (flux pedagogic):
- Dashboard, Clase și elevi, Teme, Implicare, Concursuri, Cine iese la tablă

**Rândul 2** (instrumente personale ale profesorului):
- Documente, Jurnal, Portofoliul meu

### Detalii tehnice
- Înlocuiesc `navItems` cu două array-uri (`navItemsRow1`, `navItemsRow2`).
- Containerul sticky devine `flex-col`; fiecare rând rămâne `overflow-x-auto whitespace-nowrap` pentru ecrane înguste.
- Al doilea rând primește un separator subtil (`border-t` sau spațiere) ca să se citească vizual ca grup distinct.
- Restul layout-ului (header, ModuleSwitcher, main) rămâne neschimbat.

Niciun impact pe rute, RLS sau logica de business.