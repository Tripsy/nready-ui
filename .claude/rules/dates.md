---
paths:
  - "src/helpers/date.helper.ts"
---

# Dates and Timezones

`src/helpers/date.helper.ts` carries three deliberate conventions - don't "unify" them:

1. *Typed times* mean the **user's device clock**. `combineDateAndTime` uses `setHours`,
   which resolves in the runtime zone, and these run client-side; serialising the Date gives
   the backend the right UTC instant.
2. *Filter day-boundaries* mean **company time** - `toUTCISOString` reads its input as
   `app.timezone` so two managers in different countries filtering the same day get the same
   rows. This is the only place company time applies.
3. *Display* is always the user's device zone, which happens for free: table and stats data
   is fetched client-side, so no timestamp is ever server-rendered (verified - the SSR HTML
   for `/dashboard` and `/dashboard/user` contains no formatted dates). Keep it that way; a
   date formatted in a server component would render in the container's UTC.
