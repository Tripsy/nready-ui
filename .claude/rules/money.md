---
paths:
  - "src/services/cash-flow.service.ts"
  - "src/helpers/string.helper.ts"
---

# Money

The backend stores amounts as separator-less integers scaled by `10 ** AMOUNT_DECIMALS` (4) -
`cash-flow.service.ts` persists `Math.round(abs(amount) * 10000)` and divides back on read, so
80.6452 is row value 806452. Forms accept 2 decimals; anything past the 4th is discarded by
that round-trip.

The VAT helpers in `src/helpers/string.helper.ts` round to the same precision - keep any new
amount maths on `roundAmount()` rather than returning raw float.
