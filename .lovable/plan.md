## Problemă identificată

La rezervarea publică din 27.04 (Florescu Cosmin) nu s-a trimis email pentru că:

1. **401 Unauthorized**: `public-book-event` apelează `send-transactional-email`, dar aceasta din urmă are `verify_jwt = true` în `supabase/config.toml`. Apelul intern (cu service role) este respins înainte să ruleze codul. Logurile rețelei confirmă: `POST … /send-transactional-email → 401`.
2. **Infrastructură email incompletă**: tabela `email_send_log` și cronul `process-email-queue` există, dar RPC-ul `enqueue_email` (și probabil `read_email_batch`, `delete_email`, `move_to_dlq` + cozile pgmq) lipsesc. Chiar dacă apelul ar trece de 401, trimiterea ar eșua la enqueue.

## Plan

1. **Reinstalează infrastructura de email** (idempotent): cozi pgmq, RPC-urile `enqueue_email` / `read_email_batch` / `delete_email` / `move_to_dlq`, secret în Vault, cron `process-email-queue`. Folosesc `email_domain--setup_email_infra`.

2. **Permite invocarea internă din `public-book-event`**: modific `supabase/config.toml` pentru `send-transactional-email` să folosească `verify_jwt = false` (funcția validează deja intern în cod prin idempotency + service role și e apelată server-to-server). Alternativ, păstrez verify_jwt și schimb apelul din `public-book-event` să folosească `fetch` cu `Authorization: Bearer SERVICE_ROLE_KEY` — dar e mai simplu și consistent cu restul funcțiilor `public-*` să dezactivez verify_jwt.

3. **Redeploy** `send-transactional-email`, `process-email-queue`, `handle-email-unsubscribe`, `handle-email-suppression`, `public-book-event`.

4. **Retrimite emailul pentru rezervarea Florescu Cosmin** (id `436289d1-…`) apelând manual `send-transactional-email` cu același payload ca în `public-book-event`, ca să nu rămână fără confirmare. Folosesc `idempotencyKey = public-booking-436289d1-…` pentru a evita duplicarea pe viitor.

5. **Verificare**: fac o rezervare publică de test sau verific `email_send_log` după pasul 4 ca să confirm `status = sent`.

## Note

- Domeniul `notify.evenimentecncv.online` este verificat și activ.
- Nu modific templatele existente.
- Nu ating logica de business din `public-book-event` în afara comentariilor.
