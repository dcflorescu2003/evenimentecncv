# API CNCV pentru aplicația cantinei

Bază: `https://xqfnbxvumznnmjndkhpj.supabase.co/functions/v1/canteen-api`

Autentificare: antetul `x-api-key: <CHEIA_PRIMITĂ>` la fiecare cerere.
(Alternativ `Authorization: Bearer <CHEIA_PRIMITĂ>`.)

Toate răspunsurile sunt JSON. CORS este activ.

---

## 1. Lista elevilor (import / sincronizare)

`GET|POST /students?limit=500&offset=0`

- `limit`: 1–1000 (implicit 500), `offset`: de la 0.
- Se apelează repetat, crescând `offset`, până când `students` e gol.

Răspuns:

```json
{
  "students": [
    {
      "id": "0f5e...uuid",
      "first_name": "Elias",
      "last_name": "AAD",
      "display_name": "AAD Elias",
      "student_identifier": "12345",
      "class": "IX C",
      "is_active": true
    }
  ],
  "limit": 500,
  "offset": 0,
  "count": 1
}
```

`id` este identificatorul unic al elevului în sistemul CNCV — folosește-l ca
cheie în baza ta de date (este același `id` returnat la scanare).

Exemplu:

```bash
curl -H "x-api-key: $CNCV_KEY" \
  "https://xqfnbxvumznnmjndkhpj.supabase.co/functions/v1/canteen-api/students?limit=500&offset=0"
```

---

## 2. Identificarea elevului după legitimație (scanare QR)

`POST /resolve-badge`

Corp:

```json
{ "qr": "CNCV-STU2:aBc123..." }
```

Trimite exact textul citit din codul QR.

Răspuns la succes (HTTP 200):

```json
{
  "ok": true,
  "student_id": "0f5e...uuid",
  "first_name": "Elias",
  "last_name": "AAD",
  "display_name": "AAD Elias",
  "student_identifier": "12345",
  "class": "IX C"
}
```

Răspuns la eșec (HTTP 404):

```json
{ "ok": false, "message": "Cod expirat. Cere elevului codul curent." }
```

Mesaje posibile:
- `Cod QR invalid.`
- `Cod expirat. Cere elevului codul curent.`
- `Cod deja folosit. Cere elevului codul curent.`
- `Cod vechi, expirat. Elevul trebuie să deschidă din nou legitimația.`
- `Elev inexistent.`

Exemplu:

```bash
curl -X POST -H "x-api-key: $CNCV_KEY" -H "Content-Type: application/json" \
  -d '{"qr":"CNCV-STU2:aBc123..."}' \
  "https://xqfnbxvumznnmjndkhpj.supabase.co/functions/v1/canteen-api/resolve-badge"
```

---

## Observații importante

- Codul QR al legitimației se schimbă la fiecare ~20 de secunde și este valabil
  25 de secunde. Scanează și trimite imediat.
- Scanarea la cantină **nu consumă** codul: același cod rămâne valabil pentru
  prezența la cluburi și voluntariat până expiră.
- Coduri de eroare: `401` cheie lipsă/greșită, `400` corp invalid, `404`
  acțiune necunoscută sau cod nerezolvat, `500` eroare de server.
- Cheia de acces este secretă: ține-o pe server, niciodată în codul aplicației
  mobile sau în frontend public.
