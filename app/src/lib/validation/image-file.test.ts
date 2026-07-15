import { describe, expect, it } from "vitest";
import { imageFileMetaSchema } from "./schemas";
import { VALIDATION_MESSAGES_PL } from "./messages";

describe("imageFileMetaSchema (AC-05, AC-06 client-side pre-check)", () => {
  it("rejects when no file is provided", () => {
    const result = imageFileMetaSchema.safeParse(undefined);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(VALIDATION_MESSAGES_PL.imageRequired);
  });

  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s within the size limit", (type) => {
    const result = imageFileMetaSchema.safeParse({ type, size: 5 * 1024 * 1024 });
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported type such as image/gif", () => {
    const result = imageFileMetaSchema.safeParse({ type: "image/gif", size: 1024 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(VALIDATION_MESSAGES_PL.imageInvalid);
  });

  it("rejects a non-image type such as application/pdf", () => {
    const result = imageFileMetaSchema.safeParse({ type: "application/pdf", size: 1024 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(VALIDATION_MESSAGES_PL.imageInvalid);
  });

  it("accepts a file of exactly 10 MB (boundary)", () => {
    const result = imageFileMetaSchema.safeParse({ type: "image/jpeg", size: 10 * 1024 * 1024 });
    expect(result.success).toBe(true);
  });

  it("rejects a file one byte over 10 MB", () => {
    const result = imageFileMetaSchema.safeParse({ type: "image/jpeg", size: 10 * 1024 * 1024 + 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(VALIDATION_MESSAGES_PL.imageInvalid);
  });

  it("states both the allowed formats and the size limit in the single error message (AC-05)", () => {
    const result = imageFileMetaSchema.safeParse({ type: "image/gif", size: 1024 });
    expect(result.success).toBe(false);
    const message = result.error?.issues[0]?.message ?? "";
    expect(message).toMatch(/JPG/);
    expect(message).toMatch(/PNG/);
    expect(message).toMatch(/WebP/);
    expect(message).toMatch(/10 MB/);
  });
});
