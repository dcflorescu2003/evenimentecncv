## Problema

În `StudentEventDetailPage.tsx`, dialogul „Încarcă formular completat" folosește `<input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg">`.

Pe mobil apar două probleme:
1. **PDF-urile nu apar în picker pe web mobil** — pe iOS/Android browser, extensiile (`.pdf`) sunt deseori ignorate, doar MIME types sunt onorate corect. De aceea apar doar imagini (image/*).
2. **Pozele cu paginile completate nu se încarcă în aplicația mobilă (Capacitor)** — cel mai probabil pentru că iPhone-ul livrează fotografii HEIC (`image/heic`), iar validarea client-side respinge tot ce nu e PDF/DOCX/imagine recunoscută. În plus, pe Capacitor `<input type="file">` poate avea comportament inconsistent, iar dimensiunea > 10MB de la cameră trece ușor de limită.

## Schimbări (doar frontend, fără logică nouă)

### 1. `src/pages/student/StudentEventDetailPage.tsx`

**a) `accept` cu MIME types + extensii + HEIC:**
```
accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/*,.heic,.heif"
```
Asta forțează picker-ul mobil să afișeze și fișiere (Files / Documents / Drive), nu doar galeria.

**b) Validare mai permisivă în `handleSubmissionUpload`:**
- acceptă orice `image/*` (inclusiv `image/heic`, `image/heif`)
- acceptă pdf / doc / docx prin MIME **sau** extensie
- mesaj de eroare clar dacă MIME e gol pe mobil (fallback strict pe extensie)

**c) Mesaj de ajutor în dialog pentru mobil:**
"Poți încărca poze cu paginile completate sau un PDF/Word. Pe iPhone, dacă fotografia este HEIC, va fi acceptată automat."

**d) Buton secundar „Fă o poză" pe mobil** (opțional, util):
Un al doilea `<input type="file" accept="image/*" capture="environment">` ascuns + buton care îl declanșează, ca să deschidă direct camera. Util când elevul vrea să fotografieze pagina pe loc.

**e) Limita de 10MB rămâne**, dar afișăm dimensiunea efectivă în mesaj dacă e depășită ("Fișierul are X MB, maxim 10MB").

### 2. Fără modificări la storage / RLS / edge functions
Bucket-ul `event-files` și politicile pentru `form_submissions` sunt deja corecte și permit elevului să încarce. Problema e strict la nivel de input HTML + validare.

## Ce NU schimb
- Logica de upload Supabase Storage
- Politicile RLS
- Structura DB
- Fluxul pentru profesor / CSE

## Verificare
După implementare, pe mobil:
- Tap pe „Încarcă formular completat" → în file picker apar și **Files/Documents** (nu doar Galerie)
- Selectare PDF → upload OK
- Selectare poză HEIC din iPhone → upload OK
- Buton „Fă o poză" → deschide camera direct