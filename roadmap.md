# Feedback links
- [x] Add feedback copy-link button and authenticated shared-link entry.
- [x] Preserve database-enforced access and show a clear denial state.
- [x] Test authorized navigation in the browser, missing-form denial, and RLS-denied behavior in unit tests.

# CSE feedback access
- [x] Restrict CSE feedback reads in the database and management pages.
- [x] Test own-form access and denial for other creators (automated tests); administrator report verified in browser. No CSE account exists for authenticated CSE browser verification.

# Feedback exports
- [x] Route PDF and Excel through mobile-safe saving and prevent truncated worksheet-name collisions.
- [ ] Verify export contents, download flow and mobile file delivery calls.