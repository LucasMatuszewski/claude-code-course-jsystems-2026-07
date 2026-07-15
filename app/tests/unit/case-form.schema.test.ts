import { describe, expect, it } from "vitest";
import { pl } from "@/lib/copy/pl";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  caseFormSchema,
  EQUIPMENT_CATEGORIES,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/validation/case-form.schema";

function futureIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function pastIsoDate(): string {
  return "2026-01-01";
}

const validImage = { mimeType: "image/jpeg", sizeBytes: 1024 };

function validZwrotPayload(overrides: Record<string, unknown> = {}) {
  return {
    requestType: "zwrot",
    category: "Smartfon",
    productName: "iPhone 14",
    purchaseDate: pastIsoDate(),
    image: validImage,
    ...overrides,
  };
}

function validReklamacjaPayload(overrides: Record<string, unknown> = {}) {
  return {
    requestType: "reklamacja",
    category: "Laptop",
    productName: "Dell XPS 13",
    purchaseDate: pastIsoDate(),
    description: "Pęknięta obudowa w okolicy zawiasu.",
    image: validImage,
    ...overrides,
  };
}

function firstErrorMessage(result: ReturnType<typeof caseFormSchema.safeParse>, path?: string) {
  if (result.success) throw new Error("expected failure");
  const issue = path
    ? result.error.issues.find((i) => i.path.join(".") === path)
    : result.error.issues[0];
  return issue?.message;
}

describe("caseFormSchema", () => {
  it("accepts a fully valid 'zwrot' payload with description omitted", () => {
    const result = caseFormSchema.safeParse(validZwrotPayload());
    expect(result.success).toBe(true);
  });

  it("accepts a fully valid 'reklamacja' payload with description present", () => {
    const result = caseFormSchema.safeParse(validReklamacjaPayload());
    expect(result.success).toBe(true);
  });

  it("exposes exactly the 7 PRD category values", () => {
    expect(EQUIPMENT_CATEGORIES).toEqual([
      "Smartfon",
      "Laptop",
      "Tablet",
      "Telewizor",
      "Słuchawki",
      "Monitor",
      "Inne",
    ]);
  });

  it("exposes the 3 allowed image MIME types and the 10 MB limit", () => {
    expect(ALLOWED_IMAGE_MIME_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  describe("required fields missing", () => {
    it("rejects missing requestType", () => {
      const payload = validZwrotPayload();
      delete (payload as Record<string, unknown>).requestType;
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "requestType")).toBe(pl.form.errors.requestTypeRequired);
    });

    it("rejects missing category", () => {
      const payload = validZwrotPayload();
      delete (payload as Record<string, unknown>).category;
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "category")).toBe(pl.form.errors.categoryRequired);
    });

    it("rejects missing productName", () => {
      const payload = validZwrotPayload();
      delete (payload as Record<string, unknown>).productName;
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "productName")).toBe(pl.form.errors.productNameRequired);
    });

    it("rejects empty productName", () => {
      const payload = validZwrotPayload({ productName: "" });
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "productName")).toBe(pl.form.errors.productNameRequired);
    });

    it("rejects missing purchaseDate", () => {
      const payload = validZwrotPayload();
      delete (payload as Record<string, unknown>).purchaseDate;
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "purchaseDate")).toBe(pl.form.errors.purchaseDateInvalid);
    });

    it("rejects missing image", () => {
      const payload = validZwrotPayload();
      delete (payload as Record<string, unknown>).image;
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "image")).toBe(pl.form.errors.imageRequired);
    });
  });

  describe("description required only for reklamacja (AC-03)", () => {
    it("rejects empty description when requestType is reklamacja", () => {
      const payload = validReklamacjaPayload({ description: "" });
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "description")).toBe(
        pl.form.errors.descriptionRequiredForComplaint,
      );
    });

    it("rejects missing description when requestType is reklamacja", () => {
      const payload = validReklamacjaPayload();
      delete (payload as Record<string, unknown>).description;
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "description")).toBe(
        pl.form.errors.descriptionRequiredForComplaint,
      );
    });

    it("accepts missing description when requestType is zwrot", () => {
      const payload = validZwrotPayload();
      delete (payload as Record<string, unknown>).description;
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("purchaseDate (AC-04)", () => {
    it("rejects a future purchaseDate", () => {
      const payload = validZwrotPayload({ purchaseDate: futureIsoDate() });
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "purchaseDate")).toBe(pl.form.errors.purchaseDateFuture);
    });

    it("rejects a malformed purchaseDate string", () => {
      const payload = validZwrotPayload({ purchaseDate: "not-a-date" });
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "purchaseDate")).toBe(pl.form.errors.purchaseDateInvalid);
    });
  });

  describe("category enum (AC-02)", () => {
    it("rejects a category outside the 7-value enum", () => {
      const payload = validZwrotPayload({ category: "Drukarka" });
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "category")).toBe(pl.form.errors.categoryRequired);
    });
  });

  describe("image constraints (AC-05)", () => {
    it("rejects an unsupported MIME type", () => {
      const payload = validZwrotPayload({ image: { mimeType: "image/gif", sizeBytes: 1024 } });
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "image.mimeType")).toBe(pl.form.errors.imageInvalidType);
    });

    it("rejects a file over 10 MB", () => {
      const payload = validZwrotPayload({
        image: { mimeType: "image/png", sizeBytes: MAX_IMAGE_SIZE_BYTES + 1 },
      });
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(firstErrorMessage(result, "image.sizeBytes")).toBe(pl.form.errors.imageTooLarge);
    });

    it("accepts a file exactly at the 10 MB limit", () => {
      const payload = validZwrotPayload({
        image: { mimeType: "image/webp", sizeBytes: MAX_IMAGE_SIZE_BYTES },
      });
      const result = caseFormSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
