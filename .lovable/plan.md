

## Plan: Add info dialog on the student dashboard

Add an info button (e.g., `HelpCircle` icon) in the student dashboard header area that opens a Dialog with a brief app description and the reservation flow rules.

### Single file change: `src/pages/student/StudentDashboard.tsx`

1. Import `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` and `HelpCircle` icon
2. Add a `useState` for dialog open/close
3. Place a small `HelpCircle` button next to the greeting heading
4. Dialog content (in Romanian):
   - Brief app description: the platform allows students to browse and reserve spots at extracurricular events
   - Reservation flow: browse events → reserve a spot → attend → get hours validated
   - **Warning**: students cannot attend events during class hours without teacher approval. If a reservation was made and approval was not obtained, the student must cancel the reservation themselves

