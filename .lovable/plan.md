

## Plan: Exclude public events from logged-in student events page

### What changes

**`src/pages/student/StudentEventsPage.tsx`** — line ~88

Add `.eq("is_public", false)` to the events query so public events are no longer shown to logged-in students. They can still access public events via the dedicated `/public/events` page.

### Current query
```ts
.from("events")
.select("*")
.eq("status", "published")
.eq("published", true)
```

### Updated query
```ts
.from("events")
.select("*")
.eq("status", "published")
.eq("published", true)
.eq("is_public", false)
```

### Files modified
- `src/pages/student/StudentEventsPage.tsx`

