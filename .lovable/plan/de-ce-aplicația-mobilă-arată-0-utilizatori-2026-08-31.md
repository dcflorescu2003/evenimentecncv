# De ce aplicația mobilă arată 0 utilizatori

## Cauza

Aplicația mobilă nu încarcă site-ul live: `capacitor.config.ts` nu are `server.url`, deci Android/iOS rulează codul împachetat în build-ul instalat (folderul `dist` de la momentul compilării).

Build-ul instalat pe telefon este dinainte de corectura de ieri: acolo pagina de utilizatori cerea **toate** coloanele din profiluri, inclusiv `email`, care e blocat intenționat pentru utilizatorii autentificați. Cererea primește „permission denied" și lista rămâne goală — exact simptomul „0 utilizatori".

Pe web merge pentru că browserul ia mereu codul nou publicat (verificat: interogarea din `UsersPage` cere acum doar coloanele permise, fără `email`).

## Ce fac

1. Ridic versiunea la **1.22** în cele trei locuri: `package.json`, `android/app/build.gradle` (versionCode 22 / versionName 1.22), `ios/.../project.pbxproj` (MARKETING_VERSION + CURRENT_PROJECT_VERSION).
2. Verific rapid că nu mai există alte interogări din aplicație care cer coloana blocată `email` din `profiles` (căutare `from("profiles").select("*")` în tot codul) și le corectez dacă apar — altfel aceeași eroare ar reveni în alte ecrane pe mobil.

## Ce trebuie să faci tu (nu pot rula eu build-ul nativ)

După ce aplic modificările:

1. `git pull` proiectul
2. `npm install`
3. `npm run build`
4. `npx cap sync`
5. `npx cap run android` / `npx cap run ios` — sau generezi build-ul de release și îl urci în magazine

Până când versiunea nouă ajunge pe telefon, aplicația mobilă va continua să arate 0 utilizatori; nu e o problemă de baza de date sau de drepturi.

## Detalii tehnice

- `profiles.email` are grant retras pentru rolul `authenticated`; accesul se face doar prin funcția `get_profile_emails` (admin/manager). Orice `select("*")` pe `profiles` din client eșuează cu 403.
- Nu recomand adăugarea `server.url` în `capacitor.config.ts` pentru producție (Apple respinge build-urile care încarcă conținut extern) — actualizarea prin build nou rămâne calea corectă.  
  
