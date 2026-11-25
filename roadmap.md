# CSE event details
- [x] Enable CSE room timetable navigation only, without staffroom or individual teacher/class views.
- [x] Verify room timetable access rules: seven tests pass and preview build OK.
- [ ] Verify room timetable navigation with a CSE session (available authenticated session is admin and correctly redirects away from professor pages).
- [x] Complete public participant and contact visibility on own CSE events only (public events clarified by user), preserving existing access rules.
- [x] Run four ownership tests; build OK; existing authenticated admin event shows six real public contacts.
- [ ] Verify the new view while signed in as the CSE organizer (available browser session belongs to admin; CSE session required).

# Feedback links
- [x] Add feedback copy-link button and authenticated shared-link entry.
- [x] Preserve database-enforced access and show a clear denial state.
- [x] Test authorized navigation in the browser, missing-form denial, and RLS-denied behavior in unit tests.

# CSE feedback access
- [x] Restrict CSE feedback reads in the database and management pages.
- [x] Test own-form access and denial for other creators (automated tests); administrator report verified in browser. No CSE account exists for authenticated CSE browser verification.

# Feedback exports
- [x] Route PDF and Excel through mobile-safe saving and prevent truncated worksheet-name collisions.
- [x] Verify PDF/Excel downloads with real feedback in an authenticated browser; inspect PDF and XLSX contents; 8 tests pass including native save/share calls (physical device not available).

# Duty reminders
- [x] Notify assigned duty teachers the day before at 15:00 Bucharest time, respecting the saved A/B cycle; managed schedule active, summer/winter time gate enabled.
- [x] Eleven tests pass; deployed authenticated dry run finds four real recipients for 17.11.2026, rejects unauthorized requests, and skips sends outside 15:00. Physical-device delivery has not been tested.

# Class timetable lookup
- [x] Add class selection and student name lookup with weekly/day timetable for teachers, homeroom teachers and admin; CSE remains rooms-only.
- [x] Verify secure search permissions (transactional SQL tests for admin/teacher/homeroom and denials), nine unit tests and authenticated admin desktop/mobile lookup with real student/class schedules; no page errors or mobile overflow.

# Public pseudocode simulator
- [ ] Build a public Romanian pseudocode editor and interpreter with scalar variables, vectors, input/output, conditions and loops.
- [ ] Add step-by-step and continuous execution, current-line and changed-variable highlighting, examples and syntax help.
- [ ] Add focused interpreter tests and verify the complete public flow in desktop and mobile browsers.
