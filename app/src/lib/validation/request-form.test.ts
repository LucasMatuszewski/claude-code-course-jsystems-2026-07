import { describe, expect, it } from "vitest";
import { requestFormSchema } from "./schemas";
import { VALIDATION_MESSAGES_PL } from "./messages";

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function futureIsoDate(daysAhead = 1): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pastIsoDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validImage() {
  return { type: "image/jpeg", size: 1024 };
}

function baseReturnForm(overrides: Record<string, unknown> = {}) {
  return {
    requestType: "return",
    category: "laptop",
    productName: "MacBook Air 13",
    purchaseDate: pastIsoDate(5),
    reason: undefined,
    image: validImage(),
    ...overrides,
  };
}

function baseComplaintForm(overrides: Record<string, unknown> = {}) {
  return {
    requestType: "complaint",
    category: "smartphone",
    productName: "iPhone 15",
    purchaseDate: pastIsoDate(200),
    reason: "Pękła obudowa po upadku z niewielkiej wysokości.",
    image: validImage(),
    ...overrides,
  };
}

function fieldError(result: ReturnType<typeof requestFormSchema.safeParse>, path: string): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join(".") === path)?.message;
}

describe("requestFormSchema (AC-01..AC-07)", () => {
  it("accepts a fully valid return request without a reason", () => {
    const result = requestFormSchema.safeParse(baseReturnForm());
    expect(result.success).toBe(true);
  });

  it("accepts a fully valid complaint request with a reason", () => {
    const result = requestFormSchema.safeParse(baseComplaintForm());
    expect(result.success).toBe(true);
  });

  it("rejects a submission missing every required field (AC-02)", () => {
    const result = requestFormSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(fieldError(result, "requestType")).toBe(VALIDATION_MESSAGES_PL.requestTypeRequired);
    expect(fieldError(result, "category")).toBe(VALIDATION_MESSAGES_PL.categoryRequired);
    expect(fieldError(result, "productName")).toBe(VALIDATION_MESSAGES_PL.productNameRequired);
    expect(fieldError(result, "purchaseDate")).toBe(VALIDATION_MESSAGES_PL.purchaseDateRequired);
    expect(fieldError(result, "image")).toBe(VALIDATION_MESSAGES_PL.imageRequired);
  });

  it("rejects an unknown requestType value", () => {
    const result = requestFormSchema.safeParse(baseReturnForm({ requestType: "warranty" }));
    expect(result.success).toBe(false);
    expect(fieldError(result, "requestType")).toBe(VALIDATION_MESSAGES_PL.requestTypeRequired);
  });

  it("rejects an unknown category value", () => {
    const result = requestFormSchema.safeParse(baseReturnForm({ category: "car" }));
    expect(result.success).toBe(false);
    expect(fieldError(result, "category")).toBe(VALIDATION_MESSAGES_PL.categoryRequired);
  });

  describe("reason required only for complaint (AC-03)", () => {
    it("rejects a complaint with no reason", () => {
      const result = requestFormSchema.safeParse(baseComplaintForm({ reason: undefined }));
      expect(result.success).toBe(false);
      expect(fieldError(result, "reason")).toBe(VALIDATION_MESSAGES_PL.reasonRequiredForComplaint);
    });

    it("rejects a complaint with a whitespace-only reason", () => {
      const result = requestFormSchema.safeParse(baseComplaintForm({ reason: "   " }));
      expect(result.success).toBe(false);
      expect(fieldError(result, "reason")).toBe(VALIDATION_MESSAGES_PL.reasonRequiredForComplaint);
    });

    it("accepts a return with no reason", () => {
      const result = requestFormSchema.safeParse(baseReturnForm({ reason: undefined }));
      expect(result.success).toBe(true);
    });

    it("accepts a return that does include an optional reason", () => {
      const result = requestFormSchema.safeParse(baseReturnForm({ reason: "Nie pasuje rozmiar." }));
      expect(result.success).toBe(true);
    });
  });

  describe("purchase date not in the future (AC-04)", () => {
    it("accepts today's date as the boundary", () => {
      const result = requestFormSchema.safeParse(baseReturnForm({ purchaseDate: todayIsoDate() }));
      expect(result.success).toBe(true);
    });

    it("rejects a future date", () => {
      const result = requestFormSchema.safeParse(baseReturnForm({ purchaseDate: futureIsoDate(1) }));
      expect(result.success).toBe(false);
      expect(fieldError(result, "purchaseDate")).toBe(VALIDATION_MESSAGES_PL.purchaseDateFuture);
    });

    it("rejects a malformed date string", () => {
      const result = requestFormSchema.safeParse(baseReturnForm({ purchaseDate: "15-07-2026" }));
      expect(result.success).toBe(false);
      expect(fieldError(result, "purchaseDate")).toBe(VALIDATION_MESSAGES_PL.purchaseDateInvalid);
    });
  });

  describe("product name length 2-100 (PRD §8)", () => {
    it("rejects a 1-character name", () => {
      const result = requestFormSchema.safeParse(baseReturnForm({ productName: "A" }));
      expect(result.success).toBe(false);
      expect(fieldError(result, "productName")).toBe(VALIDATION_MESSAGES_PL.productNameLength);
    });

    it("accepts the 2-character boundary", () => {
      const result = requestFormSchema.safeParse(baseReturnForm({ productName: "AB" }));
      expect(result.success).toBe(true);
    });

    it("accepts the 100-character boundary", () => {
      const result = requestFormSchema.safeParse(baseReturnForm({ productName: "A".repeat(100) }));
      expect(result.success).toBe(true);
    });

    it("rejects 101 characters", () => {
      const result = requestFormSchema.safeParse(baseReturnForm({ productName: "A".repeat(101) }));
      expect(result.success).toBe(false);
      expect(fieldError(result, "productName")).toBe(VALIDATION_MESSAGES_PL.productNameLength);
    });

    it("rejects an empty product name with the required message, not the length message", () => {
      const result = requestFormSchema.safeParse(baseReturnForm({ productName: "" }));
      expect(result.success).toBe(false);
      expect(fieldError(result, "productName")).toBe(VALIDATION_MESSAGES_PL.productNameRequired);
    });
  });

  describe("reason max length 2000 (PRD §8)", () => {
    it("accepts exactly 2000 characters", () => {
      const result = requestFormSchema.safeParse(
        baseComplaintForm({ reason: "a".repeat(2000) }),
      );
      expect(result.success).toBe(true);
    });

    it("rejects 2001 characters", () => {
      const result = requestFormSchema.safeParse(
        baseComplaintForm({ reason: "a".repeat(2001) }),
      );
      expect(result.success).toBe(false);
      expect(fieldError(result, "reason")).toBe(VALIDATION_MESSAGES_PL.reasonTooLong);
    });
  });

  describe("image constraints (AC-05)", () => {
    it("rejects a disallowed file type", () => {
      const result = requestFormSchema.safeParse(
        baseReturnForm({ image: { type: "image/gif", size: 1024 } }),
      );
      expect(result.success).toBe(false);
      expect(fieldError(result, "image")).toBe(VALIDATION_MESSAGES_PL.imageInvalid);
    });

    it("accepts exactly 10 MB (boundary)", () => {
      const result = requestFormSchema.safeParse(
        baseReturnForm({ image: { type: "image/png", size: 10 * 1024 * 1024 } }),
      );
      expect(result.success).toBe(true);
    });

    it("rejects a file 1 byte over 10 MB", () => {
      const result = requestFormSchema.safeParse(
        baseReturnForm({ image: { type: "image/png", size: 10 * 1024 * 1024 + 1 } }),
      );
      expect(result.success).toBe(false);
      expect(fieldError(result, "image")).toBe(VALIDATION_MESSAGES_PL.imageInvalid);
    });

    it("accepts JPG, PNG, and WebP", () => {
      for (const type of ["image/jpeg", "image/png", "image/webp"]) {
        const result = requestFormSchema.safeParse(baseReturnForm({ image: { type, size: 2048 } }));
        expect(result.success).toBe(true);
      }
    });
  });
});
