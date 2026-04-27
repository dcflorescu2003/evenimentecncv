## Obiectiv

Aplic regula „maxim 5 elevi rezervați per clasă” pentru cele 2 meciuri:

- **28.04** — Meci FC CANTEMIR vs TUDOR VIANU
- **29.04** — Meci FC CANTEMIR vs DIMITRIE BOLINTIANU

## Pasul 1 — Curățare rezervări existente (one-shot)

Pentru fiecare din cele 2 evenimente, pentru fiecare clasă (V, VI, VII, VIII, IX A...G, X A...G, XI ..., XII ...):

- Păstrez primii 5 elevi din clasă cu `status='reserved'`, ordonați ascendent după `created_at` (cei mai vechi câștigă).
- Restul rezervărilor primesc `status='cancelled'` și `cancelled_at=now()`.

Voi rula prin migration o operație tranzacțională care folosește `ROW_NUMBER() OVER (PARTITION BY class_id ORDER BY created_at)` pentru a marca rezervările peste poziția 5.

Notă: regula se aplică pentru **toate** clasele (inclusiv XI și XII, care sunt mai puține) — interpretare uniformă, „per clasă individuală”. Dacă vrei să exclud XI/XII, spune-mi înainte de aprobare.

## Pasul 2 — Validare hard pentru rezervări noi

Modific funcția RPC `check_booking_eligibility` să adauge o verificare specifică:

- Dacă `event_id` este unul din cele 2 (hardcodat în funcție pentru aceste meciuri), număr câți elevi din aceeași clasă a elevului curent au deja `status='reserved'` la acel eveniment.
- Dacă sunt deja ≥ 5, refuz cu mesajul: „Clasa ta a atins limita de 5 locuri pentru acest eveniment.”

Validarea rămâne aplicabilă și prin RLS / UI normal (elevii nu pot rezerva direct dacă RPC respinge).

## Pasul 3 — Raport participanți (după aplicarea regulii)

Generez 2 fișiere CSV în `/mnt/documents/`:

- `participanti-meci-28-04-tudor-vianu.csv`
- `participanti-meci-29-04-dimitrie-bolintianu.csv`

Coloane: Nume, Prenume, Clasă, Identificator elev, Data rezervării.
Sortare: după clasă, apoi alfabetic după nume.

Voi furniza tag-uri `<lov-artifact>` pentru download direct.

## Detalii tehnice

**Migration SQL** (Pasul 1):

```sql
WITH ranked AS (
  SELECT r.id,
    ROW_NUMBER() OVER (PARTITION BY r.event_id, sca.class_id ORDER BY r.created_at) AS rn
  FROM reservations r
  JOIN student_class_assignments sca ON sca.student_id = r.student_id
  WHERE r.event_id IN ('753dea88-...', '5b975ee9-...')
    AND r.status = 'reserved'
)
UPDATE reservations SET status='cancelled', cancelled_at=now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 5);
```

**RPC update** (Pasul 2): adaug un bloc în `check_booking_eligibility` înainte de `RETURN allowed=true`:

```sql
IF _event_id IN ('753dea88-...', '5b975ee9-...') AND _student_class_id IS NOT NULL THEN
  SELECT count(*) INTO _class_count
  FROM reservations r
  JOIN student_class_assignments sca ON sca.student_id = r.student_id
  WHERE r.event_id = _event_id AND r.status = 'reserved' AND sca.class_id = _student_class_id;
  IF _class_count >= 5 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Clasa ta a atins limita de 5 locuri pentru acest eveniment');
  END IF;
END IF;
```

**Raport CSV** (Pasul 3): query SQL care join-ează reservations + profiles + classes și export prin `psql COPY` în fișiere.

## Rezumat

1. Anulez rezervările peste primii 5 din fiecare clasă pentru meciurile 28.04 și 29.04.
2. Blochez rezervări noi din clasele care au deja 5 locuri la aceste 2 evenimente.
3. Generez 2 Pdf-uri descărcabile cu lista finală de participanți.