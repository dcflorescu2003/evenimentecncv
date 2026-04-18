# App Store Submission — Evenimente CNCV

## App information

- **App name**: Evenimente CNCV
- **Subtitle**: Evenimente Colegiul Cantemir Vodă
- **Bundle ID**: `com.evenimentecncv.app`
- **Primary category**: Education
- **Secondary category**: Productivity
- **Age rating**: 4+
- **Primary language**: Romanian (Romania)

## Keywords

```
școală, evenimente, CNCV, Cantemir, prezență, bilete, QR, elevi, profesori, liceu
```

## Description (RO)

Aplicația oficială a Colegiului Național „Cantemir Vodă" București pentru gestionarea evenimentelor școlare.

Elevii pot vizualiza evenimentele disponibile, rezerva locuri și prezenta biletul cu cod QR la intrare. Profesorii și diriginții pot organiza evenimente, scana prezența și monitoriza activitatea claselor. Administratorii au acces complet la rapoarte, gestionare utilizatori și configurarea sesiunilor anuale.

Funcționalități principale:
• Rezervare rapidă a locurilor la evenimente școlare
• Bilete digitale cu cod QR
• Check-in prin scanare cu camera dispozitivului
• Notificări pentru evenimentele apropiate
• Rapoarte și statistici de participare
• Suport multi-an școlar

Conturile sunt create și gestionate de administratorii școlii.

## What's new (versiune inițială)

Prima versiune a aplicației Evenimente CNCV. Include autentificare, rezervare bilete, scanare QR, notificări și rapoarte de participare.

## URLs

- **Support URL**: https://evenimentecncv.online/support
- **Privacy Policy URL**: https://evenimentecncv.online/privacy
- **Marketing URL** (opțional): https://evenimentecncv.online

## Demo account pentru App Review

```
Username: elev.test
Password: Elev123!
```

Conturi suplimentare (opțional, dacă reviewer-ul cere):
- Admin: `admin.test / Admin123!`
- Profesor: `prof.test / Prof123!`

## Note pentru reviewer

Aplicația este o platformă internă pentru elevii și personalul Colegiului Național „Cantemir Vodă" București. Conturile sunt create exclusiv de administratorii școlii — nu există înregistrare publică, ceea ce este intenționat (aplicație instituțională).

Fluxuri de testat:
1. Autentificare cu contul demo `elev.test`.
2. Vizualizare evenimente disponibile în secțiunea „Evenimente".
3. Rezervare la un eveniment activ și vizualizare bilet cu QR.
4. Anulare rezervare din „Biletele mele".
5. (Opțional) Vizitarea unui eveniment public fără autentificare prin pagina „Evenimente publice".

Pagina publică de evenimente (`/public/events`) și rezervarea anonimă sunt accesibile fără cont, conform politicii instituției pentru evenimente deschise comunității.

## Export Compliance (ITSAppUsesNonExemptEncryption)

Aplicația folosește exclusiv funcții standard de criptare HTTPS/TLS prin sistemul de operare iOS. **Nu folosește criptare proprietară.** Setat în `Info.plist`: `ITSAppUsesNonExemptEncryption = false`.

## Permissions

- **Camera** (`NSCameraUsageDescription`): folosită pentru scanarea codurilor QR la check-in la evenimente.
- **Notifications**: folosite pentru a anunța elevii despre evenimente apropiate sau înscrieri noi.

## Assets necesare (de pregătit manual)

- [ ] **App Icon** 1024×1024 (PNG, fără canal alpha, fără colțuri rotunjite)
- [ ] **Screenshots iPhone 6.7"** (1290×2796) — minim 3, maxim 10
- [ ] **Screenshots iPhone 6.5"** (1242×2688) — minim 3
- [ ] **Screenshots iPad 12.9"** (2048×2732) — opțional, doar dacă target-ul include iPad
- [ ] **Preview video** (opțional)

Sugestii capturi:
1. Pagina de login cu logo-ul CNCV
2. Lista de evenimente disponibile pentru un elev
3. Bilet cu cod QR
4. Ecranul de scanare QR (profesor)
5. Dashboard cu statistici de participare

## Capabilities Xcode (obligatoriu)

În Xcode → target **App** → **Signing & Capabilities** → **+ Capability**:
- **Push Notifications**
- **Background Modes** → bifează **Remote notifications**

APNs Key (`.p8`) trebuie încărcat în Firebase Console → Project Settings → Cloud Messaging → Apple app configuration.

## Target device

**iPhone-only** (`TARGETED_DEVICE_FAMILY = 1`). Nu sunt necesare screenshots iPad la submit.

## Privacy Manifest

`ios/App/App/PrivacyInfo.xcprivacy` este inclus automat în bundle și declară:
- `NSPrivacyTracking = false`
- API-uri „required reason" standard Capacitor: UserDefaults (CA92.1), FileTimestamp (C617.1), SystemBootTime (35F9.1), DiskSpace (E174.1)
- Tipuri de date: Email, Name, User ID, Other User Content (toate Linked, App Functionality, **NOT used for tracking**)

## Privacy Nutrition Labels (App Store Connect)

- **Contact Info → Email Address** — Linked, App Functionality
- **Contact Info → Name** — Linked, App Functionality
- **Identifiers → User ID** — Linked, App Functionality
- **User Content → Other User Content** — Linked, App Functionality
- **User Content → Photos or Videos** (opțional, QR salvat) — Not linked, App Functionality
- **Tracking: No**

## Account deletion (Guideline 5.1.1(v))

Confirmat — utilizatorii își pot șterge contul din UI după login (ruta `/delete-account`, edge function `delete-own-account`).

## Checklist final înainte de submit

- [ ] `capacitor.config.ts` — fără `server.url` activ pentru build production
- [ ] `Info.plist` — `NSCameraUsageDescription`, `UIBackgroundModes=remote-notification`, `arm64`, `CFBundleDevelopmentRegion=ro`, `ITSAppUsesNonExemptEncryption=false` ✅
- [ ] `PrivacyInfo.xcprivacy` prezent în bundle ✅
- [ ] `TARGETED_DEVICE_FAMILY = 1` (iPhone-only) ✅
- [ ] Capabilities în Xcode: Push Notifications + Background Modes (Remote notifications)
- [ ] `npm run build` rulează fără erori
- [ ] `npx cap sync ios` executat după modificări
- [ ] Build production în Xcode cu certificat de distribuție Apple Developer
- [ ] Upload prin Xcode Organizer sau Transporter
- [ ] Metadata completate în App Store Connect (text, screenshots iPhone, URLs)
- [ ] Privacy Nutrition Labels completate ca mai sus
- [ ] Demo account funcțional verificat înainte de submit

## Contact

**Colegiul Național „Cantemir Vodă" București**
E-mail: lcantemirvoda@yahoo.com
