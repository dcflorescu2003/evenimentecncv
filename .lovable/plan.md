
## Plan: Afișează codul complet al biletului sub QR

### Problema
Sub QR code apare un cod trunchiat cu „..." la sfârșit. Când userul îl introduce manual în pagina de scanare, nu funcționează pentru că e incomplet — `qr_code_data` real e mai lung decât ce se afișează.

### Investigație necesară (în default mode)
- Caut în `src/pages/student/StudentTicketsPage.tsx` și `src/pages/public/PublicTicketViewPage.tsx` unde e afișat codul sub QR.
- Identific clasa CSS care taie textul (`truncate`, `text-ellipsis`, `line-clamp`) sau un `slice/substring` în cod.

### Soluție
1. **Elimin trunchierea vizuală** — fie scot clasa `truncate`, fie folosesc `break-all` + `font-mono` ca să încapă pe mai multe linii.
2. **Adaug buton „Copiază cod"** lângă cod (icon `Copy` din lucide) care copiază în clipboard `qr_code_data` complet — UX mult mai sigur decât tastarea manuală a unui UUID.
3. **Aplicabil pe**: `StudentTicketsPage.tsx`, `PublicTicketViewPage.tsx` (oriunde se afișează codul sub QR).

### Ce NU se schimbă
- Logica de scanare, generare QR, RLS, schema DB.
