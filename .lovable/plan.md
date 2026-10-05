# Reparare „Normă nesetată" pe cartonașul de normă

## Cauza (confirmată)
Norma e salvată corect: contul **florescu.cosmin** are 20 h în baza de date. Problema apare la încărcarea profilului la conectare. Aplicația citește doar numele, utilizatorul și starea contului, nu și norma. Cartonașul primește astfel mereu 0 și afișează „Normă nesetată" pentru toată lumea.

## Ce schimb
- La conectare se încarcă și norma de ore, împreună cu restul profilului.
- Cartonașul va arăta `X h / 20 h` pentru florescu.cosmin, cu bara de progres și cu „Lipsesc …" sau „Normă acoperită".
- Contul **cosmin.florescu** nu are normă setată, deci va afișa în continuare „Normă nesetată". Așa e corect.

## Detalii tehnice
- `src/hooks/useAuth.tsx`: se adaugă `teaching_norm` în select-ul din `profiles` și în interfața `Profile` (`teaching_norm: number | null`).
- `NormProgressCard.tsx`: se elimină cast-ul `as any`. Nu se modifică baza de date.
