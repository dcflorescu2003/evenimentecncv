# Reparare: perioada de înscriere se schimbă după salvare

## Cauza (confirmată în cod)
Când se salvează data și ora de deschidere/închidere a înscrierilor, aplicația calculează diferența de fus orar față de București. Calculul greșește pe orice calculator sau telefon setat pe ora României: crede că diferența este 0 în loc de +3 h (vara) / +2 h (iarna). Ora se salvează astfel ca oră UTC, iar la redeschidere apare mutată cu 2–3 ore (uneori și ziua, dacă ora e aproape de miezul nopții). De aceea pare „random”: depinde de dispozitiv și de anotimp.

Afectează toate formularele de eveniment: profesor (listă și detalii) și admin.

## Ce se schimbă
1. Calculul diferenței de fus orar se face corect, indiferent de setarea dispozitivului (folosind direct regulile fusului Europe/Bucharest, nu ora locală a telefonului).
2. Test automat care verifică: ora introdusă 08:00 rămâne 08:00 după salvare și reîncărcare, vara și iarna, inclusiv în zilele de schimbare a orei.
3. Verificare în baza de date a evenimentelor deja salvate cu ore deplasate; listă trimisă ție ca să decizi dacă le corectez automat (−2/−3 h) sau le reeditează profesorii. Nu modific nimic fără acordul tău.

## Detalii tehnice
- `src/lib/time.ts` → `getBucharestOffsetHours`: probe-ul `new Date("YYYY-MM-DD HH:mm:ss")` e interpretat în fusul browserului, deci diferența iese 0 în România. Înlocuire cu `Intl.DateTimeFormat(..., { timeZone: "Europe/Bucharest", timeZoneName: "longOffset" })` sau calcul din `formatToParts` comparat cu `Date.UTC(...)`; offset calculat pentru data+ora efectivă, nu fix la 12:00.
- `joinDatetime` primește offsetul pentru momentul exact; `splitDatetime` rămâne neschimbat (e corect).
- Teste în `src/test/time.test.ts` rulate cu `TZ=Europe/Bucharest` și `TZ=UTC`.
- Interogare read-only pe `events.booking_open_at/booking_close_at` pentru valori cu minute/ore suspecte după ultimele editări.
