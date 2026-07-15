---
window_days: 730
window_rule_id: C-1
---

# Complaint Policy (Reklamacje) — Example Company Document

> Example policy authored for the Hardware Service Decision Copilot MVP.
> This document is injected into the decision agent's context for every **Complaint** request.
> The agent must derive complaint decisions exclusively from the rules below.

## 1. Complaint window

- C-1: A complaint may be submitted within **24 months** from the date of purchase.
- C-2: Complaints submitted after 24 months must be rejected. Claimed extended manufacturer warranties are outside this policy; such cases are escalated to a human employee.

## 2. Covered defects

A complaint is justified when the defect existed in the product or arose from a cause inherent to it:

- C-3: Manufacturing defects: faulty components, premature wear of parts under normal use, defects in materials or assembly (e.g. hinge failure under normal use, dead pixels, swollen battery, delaminating casing).
- C-4: Functional failures without external cause: device does not power on, overheats, random shutdowns, ports or buttons stop working under normal use.
- C-5: Defects present at purchase but discovered later.

## 3. Excluded damage

A complaint is not justified when the damage was caused by the user or external factors:

- C-6: Mechanical damage from impact or drop (cracked screen with impact point, dented corners, cracked casing radiating from a hit point).
- C-7: Liquid damage (corrosion, stains under the screen, liquid indicators triggered).
- C-8: Unauthorized repair or modification (non-original parts, tampered seals, missing screws).
- C-9: Damage from misuse: use contrary to the manual, wrong power supply, extreme temperatures.
- C-10: Normal cosmetic wear that does not affect function (fine scratches from regular use) is not a defect.

## 4. Decision guidance

- C-11: If the photo shows damage consistent with a manufacturing defect (C-3–C-5) and the window holds → recommend **APPROVE**.
- C-12: If the photo shows damage clearly matching an exclusion (C-6–C-9) → recommend **REJECT**, citing the specific exclusion.
- C-13: If the cause is ambiguous from the photo (e.g. cracked screen without a visible impact point, intermittent fault not visible in a photo) → ask for **MORE_INFO** (when did it appear, in what circumstances, does it recur) or **ESCALATE** for physical inspection.
- C-14: Complaints about defects not visible in a photo (e.g. battery drain, random shutdowns) rely on the customer's description; if the description is plausible and specific and the window holds, recommend **APPROVE** with physical verification noted in next steps; if vague, ask for **MORE_INFO**.
- C-15: The complaint window rule (C-1–C-2) is a **hard rule**: an exceeded window can never result in APPROVE.

## 5. Approved complaint — next steps for the customer

- C-16: Communicate these steps on approval:
  1. An employee will confirm the decision and the customer will receive shipping instructions for the service center.
  2. The service center verifies the defect physically; verification may change the outcome.
  3. Resolution order: repair first; replacement if repair is not feasible; refund if neither is feasible. Target resolution time: 14 business days from the product arriving at the service center.
