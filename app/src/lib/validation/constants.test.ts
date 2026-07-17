import { describe, expect, it } from "vitest";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  MAX_IMAGE_SIZE_BYTES,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NAME_MIN_LENGTH,
  REASON_MAX_LENGTH,
  CHAT_MESSAGE_MAX_LENGTH,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_VALUES,
} from "./constants";

describe("validation constants", () => {
  it("defines request types as stable keys matching the DB CHECK constraint (ADR-003)", () => {
    expect(REQUEST_TYPE_VALUES).toEqual(["complaint", "return"]);
  });

  it("provides a Polish label for every request type key", () => {
    expect(REQUEST_TYPE_LABELS.complaint).toBe("Reklamacja");
    expect(REQUEST_TYPE_LABELS.return).toBe("Zwrot");
  });

  it("defines the exact PRD §8 category list as stable keys, in order", () => {
    expect(CATEGORY_VALUES).toEqual([
      "smartphone",
      "laptop",
      "tablet",
      "tv_monitor",
      "audio",
      "small_appliance",
      "peripherals",
      "other",
    ]);
  });

  it("provides a Polish label for every category key", () => {
    for (const key of CATEGORY_VALUES) {
      expect(CATEGORY_LABELS[key]).toEqual(expect.any(String));
      expect(CATEGORY_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it("matches PRD §8 functional constraints for text and file limits", () => {
    expect(PRODUCT_NAME_MIN_LENGTH).toBe(2);
    expect(PRODUCT_NAME_MAX_LENGTH).toBe(100);
    expect(REASON_MAX_LENGTH).toBe(2000);
    expect(CHAT_MESSAGE_MAX_LENGTH).toBe(2000);
    expect(MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(ALLOWED_IMAGE_MIME_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
