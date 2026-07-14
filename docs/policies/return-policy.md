# Return Policy (Zwroty) — Example Company Document

> Example policy authored for the Hardware Service Decision Copilot MVP.
> This document is injected into the decision agent's context for every **Return** request.
> The agent must derive return decisions exclusively from the rules below.

## 1. Return window

- R-1: A product may be returned within **14 calendar days** from the date of purchase.
- R-2: The day of purchase counts as day 0; the return request must be submitted on day 14 at the latest.
- R-3: Requests submitted after the return window must be rejected. No exceptions may be granted by the assistant; a customer who claims special circumstances (e.g. hospital stay, delayed delivery) is escalated to a human employee.

## 2. Product condition requirements

A returned product must be resellable as new. All of the following must hold:

- R-4: No mechanical damage (cracks, dents, scratches, broken elements).
- R-5: No visible signs of usage (worn keys or buttons, screen wear, dirt, fingerprints baked into surfaces, smell of smoke).
- R-6: No missing parts visible in the photo (e.g. missing battery cover, missing detachable accessories that are part of the product itself).
- R-7: Factory protective films may be removed; this alone does not disqualify a return.
- R-8: Original packaging is **recommended but not required**; a missing box alone does not disqualify a return.

## 3. Product categories excluded from returns

- R-9: In-ear headphones and other personal hygiene–sensitive audio products are excluded from returns **if the photo or customer statement indicates they were used**. Unused, they are returnable.
- R-10: Products with personalized engraving or custom configuration are not returnable; such cases are escalated.

## 4. Decision guidance

- R-11: If the photo shows no damage and no signs of usage, and the return window holds → recommend **APPROVE**.
- R-12: If the photo shows damage or clear signs of usage → recommend **REJECT**, citing the specific condition rule (R-4/R-5/R-6).
- R-13: If the photo is inconclusive about usage (e.g. product photographed in packaging, angle hides key surfaces) → ask for **MORE_INFO** (text) or **ESCALATE** if a better photo would be required.
- R-14: The return window rule (R-1–R-3) is a **hard rule**: an exceeded window can never result in APPROVE.

## 5. Approved return — next steps for the customer

- R-15: Communicate these steps on approval:
  1. Pack the product securely, with all included accessories.
  2. An employee will confirm the decision and the customer will receive return shipping instructions.
  3. The refund is issued to the original payment method within 14 days of the product arriving at the warehouse.
