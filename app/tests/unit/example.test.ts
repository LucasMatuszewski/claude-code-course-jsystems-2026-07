import { describe, expect, it } from "vitest";

describe("unit test infrastructure smoke test", () => {
  it("runs a trivial assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
