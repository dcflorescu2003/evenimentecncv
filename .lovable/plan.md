

## Plan: Pagina publică Politica de Confidențialitate

### Ce se face

O pagină statică la ruta `/privacy` cu textul politicii de confidențialitate, accesibilă fără autentificare, cu link în footer-ul paginilor publice.

### Implementare

**1. Pagină nouă: `src/pages/public/PrivacyPolicyPage.tsx`**
- Layout simplu, centrat, responsive
- Titlu "Politica de Confidențialitate"
- Secțiuni standard: date colectate, scopul prelucrării, drepturile utilizatorilor, contact, cookies
- Adaptată contextului aplicației (sistem de gestionare evenimente/prezență pentru CNCV)
- Buton "Înapoi" către pagina anterioară

**2. Rutare: `src/App.tsx`**
- Adaug ruta `/privacy` cu `PrivacyPolicyPage`

### Fișiere

| Tip | Fișier |
|-----|--------|
| Nou | `src/pages/public/PrivacyPolicyPage.tsx` |
| Editat | `src/App.tsx` — adaug ruta `/privacy` |

