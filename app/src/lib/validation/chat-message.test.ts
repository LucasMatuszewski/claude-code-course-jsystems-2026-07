import { describe, expect, it } from "vitest";
import { chatMessageSchema } from "./schemas";
import { VALIDATION_MESSAGES_PL } from "./messages";

describe("chatMessageSchema (AC-18, AC-20)", () => {
  it("accepts a normal Polish message", () => {
    const result = chatMessageSchema.safeParse("Czy zwrot obejmuje uszkodzoną baterię?");
    expect(result.success).toBe(true);
  });

  it("rejects an empty message", () => {
    const result = chatMessageSchema.safeParse("");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(VALIDATION_MESSAGES_PL.chatMessageRequired);
  });

  it("rejects a whitespace-only message", () => {
    const result = chatMessageSchema.safeParse("   \n  ");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(VALIDATION_MESSAGES_PL.chatMessageRequired);
  });

  it("rejects a missing message value", () => {
    const result = chatMessageSchema.safeParse(undefined);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(VALIDATION_MESSAGES_PL.chatMessageRequired);
  });

  it("accepts exactly 2000 characters (boundary)", () => {
    const result = chatMessageSchema.safeParse("a".repeat(2000));
    expect(result.success).toBe(true);
  });

  it("rejects 2001 characters", () => {
    const result = chatMessageSchema.safeParse("a".repeat(2001));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(VALIDATION_MESSAGES_PL.chatMessageTooLong);
  });
});
