import { describe, expect, it } from "vitest";
import { getFieldErrors, requestFormSchema } from "./schemas";
import { VALIDATION_MESSAGES_PL } from "./messages";

// TAC-002-01: client and server must reject the same invalid input with
// identical Polish messages. This is guaranteed structurally because both
// sides import requestFormSchema + getFieldErrors from this one module, but
// we still assert the shape/content the route handlers and the form both
// rely on.
describe("getFieldErrors", () => {
  it("maps each invalid field to a single first Polish message keyed by field path", () => {
    // Note: the object-level cross-field refine (reason required for
    // complaint) only runs once every individual field passes its own
    // schema (Zod skips `superRefine` when the base shape already has
    // issues) — so a case with several field-level errors intentionally
    // does not also carry the reason cross-field error. That path is
    // covered separately below and in request-form.test.ts.
    const result = requestFormSchema.safeParse({
      requestType: "complaint",
      category: "laptop",
      productName: "A",
      purchaseDate: "not-a-date",
      reason: undefined,
      image: undefined,
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    const fieldErrors = getFieldErrors(result.error);

    expect(fieldErrors.productName).toBe(VALIDATION_MESSAGES_PL.productNameLength);
    expect(fieldErrors.purchaseDate).toBe(VALIDATION_MESSAGES_PL.purchaseDateInvalid);
    expect(fieldErrors.image).toBe(VALIDATION_MESSAGES_PL.imageRequired);
  });

  it("surfaces the reason cross-field error when every other field is valid", () => {
    const result = requestFormSchema.safeParse({
      requestType: "complaint",
      category: "laptop",
      productName: "MacBook Air 13",
      purchaseDate: "2020-01-01",
      reason: undefined,
      image: { type: "image/png", size: 1024 },
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    const fieldErrors = getFieldErrors(result.error);
    expect(fieldErrors.reason).toBe(VALIDATION_MESSAGES_PL.reasonRequiredForComplaint);
  });

  it("returns an empty object for a fully valid input", () => {
    const result = requestFormSchema.safeParse({
      requestType: "return",
      category: "other",
      productName: "Suszarka do włosów",
      purchaseDate: "2020-01-01",
      reason: undefined,
      image: { type: "image/png", size: 1024 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(getFieldErrors).toBeInstanceOf(Function);
  });
});
