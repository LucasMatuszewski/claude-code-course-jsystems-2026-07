import { describe, expect, it } from "vitest";

import { pl } from "./pl";
import type { DecisionCategory, Pl } from "./pl";

/**
 * Recursively walks a nested readonly object and collects every string leaf
 * with its dotted path. Functions are treated as opaque here — their output
 * is asserted by a dedicated test instead, since a blanket "call every
 * function" scan cannot know what arguments are valid.
 */
function collectStringLeaves(
  value: unknown,
  path: string[] = []
): Array<{ path: string; value: string }> {
  if (typeof value === "string") {
    return [{ path: path.join("."), value }];
  }

  if (value === null || typeof value !== "object") {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nested]) => collectStringLeaves(nested, [...path, key])
  );
}

describe("pl (Polish UI strings module)", () => {
  it("contains no empty or whitespace-only strings anywhere in the structure", () => {
    const leaves = collectStringLeaves(pl);

    // Sanity check that the walk actually found the nested strings, so this
    // test cannot pass vacuously if `pl` were accidentally emptied out.
    expect(leaves.length).toBeGreaterThan(20);

    for (const leaf of leaves) {
      expect(
        leaf.value.trim().length,
        `pl.${leaf.path} must not be empty (got ${JSON.stringify(leaf.value)})`
      ).toBeGreaterThan(0);
    }
  });

  it("exposes exactly the expected top-level key groups", () => {
    expect(Object.keys(pl).sort()).toEqual(
      ["app", "chat", "common", "errorBanner", "form", "submission"].sort()
    );
  });

  it("exposes every form field group named in PRD §9.1", () => {
    expect(Object.keys(pl.form.fields).sort()).toEqual(
      [
        "category",
        "image",
        "productName",
        "purchaseDate",
        "reason",
        "requestType",
      ].sort()
    );
  });

  it("provides separate image-hint helper text for complaint vs. return (PRD §9.1)", () => {
    expect(pl.form.fields.image.helperText.complaint).not.toEqual(
      pl.form.fields.image.helperText.return
    );
  });

  it("uses the exact submit button label given in PRD §9.1", () => {
    expect(pl.form.submitButton).toBe("Wyślij zgłoszenie");
  });

  it("exposes the three staged submission progress texts verbatim (PRD §9.1)", () => {
    expect(pl.submission.stages).toEqual({
      uploading: "Wysyłanie zdjęcia…",
      analyzing: "Analizuję zdjęcie…",
      preparingDecision: "Przygotowuję decyzję…",
    });
  });

  it("exposes both error banner variants (retry + temporarily-unavailable, PRD §9.1/§4.5)", () => {
    expect(Object.keys(pl.errorBanner).sort()).toEqual(
      ["retry", "unavailable"].sort()
    );
    expect(pl.errorBanner.retry.retryButton).toBe("Spróbuj ponownie");
    expect(pl.errorBanner.retry.sessionIdLabel.length).toBeGreaterThan(0);
    expect(pl.errorBanner.unavailable.sessionIdLabel.length).toBeGreaterThan(
      0
    );
  });

  it("exposes chat retry, header, input, and not-found strings (PRD §9.2)", () => {
    expect(pl.chat.retryButton).toBe("Spróbuj ponownie");
    expect(pl.chat.header.newRequestLink.length).toBeGreaterThan(0);
    expect(pl.chat.input.sendButton.length).toBeGreaterThan(0);
    expect(pl.chat.input.placeholder.length).toBeGreaterThan(0);
    expect(Object.keys(pl.chat.sessionNotFound).sort()).toEqual(
      ["backLink", "message", "title"].sort()
    );
  });

  it("exposes decision badge labels for exactly the four decision categories (PRD §11)", () => {
    expect(Object.keys(pl.chat.decisionBadge).sort()).toEqual(
      ["APPROVE", "ESCALATE", "MORE_INFO", "REJECT"].sort()
    );
  });

  it("exposes a 'decision changed' marker (PRD §9.2, AC-21)", () => {
    expect(pl.chat.decisionChanged.arrow).toBe("→");
    expect(pl.chat.decisionChanged.badgeLabel.length).toBeGreaterThan(0);
    expect(pl.chat.decisionChanged.fromLabel).not.toEqual(
      pl.chat.decisionChanged.toLabel
    );
  });

  it("formats the character-counter accessible label in Polish", () => {
    expect(pl.common.characterCounterAriaLabel(150, 2000)).toBe(
      "150 z 2000 znaków"
    );
    expect(pl.common.characterCounterAriaLabel(0, 2000)).toBe(
      "0 z 2000 znaków"
    );
  });

  it("does not duplicate Zod validation messages (T1.1 owns those)", () => {
    // This module has no "errors"/"validation" group at all — required-field,
    // format, and length messages live exclusively in `lib/validation`
    // (ADR-002 §3). Asserting their absence keeps the two modules from
    // drifting into two sources of truth for the same wording.
    expect(pl).not.toHaveProperty("errors");
    expect(pl).not.toHaveProperty("validation");
  });
});

// ---------------------------------------------------------------------------
// Type-level completeness (compile-time only).
//
// These type aliases produce a compile error — caught by `tsc` / `next build`
// as part of the required verification suite, since vitest's default
// (esbuild) test runner does not type-check — if:
//   - any leaf of `Pl` ever widens to `any`, or
//   - a required key group is renamed/removed/added without updating this
//     test.
// `KeysMatch` / `Expect` are the standard "type testing without a library"
// helpers; `IsAny` is the standard `0 extends 1 & T` trick, since `any` is
// the one type that both `T extends any` and `any extends T` are always
// true for, so plain mutual-extends cannot detect it.
// ---------------------------------------------------------------------------

type IsAny<T> = 0 extends 1 & T ? true : false;

type KeysMatch<
  Actual extends PropertyKey,
  Expected extends PropertyKey
> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false;

type Expect<T extends true> = T;

type _NoAnyInModule = Expect<IsAny<Pl> extends true ? false : true>;
type _NoAnyInForm = Expect<IsAny<Pl["form"]> extends true ? false : true>;
type _NoAnyInChat = Expect<IsAny<Pl["chat"]> extends true ? false : true>;
type _NoAnyInCommon = Expect<IsAny<Pl["common"]> extends true ? false : true>;
type _NoAnyInCounterFnReturn = Expect<
  IsAny<ReturnType<Pl["common"]["characterCounterAriaLabel"]>> extends true
    ? false
    : true
>;

type _TopLevelKeysExact = Expect<
  KeysMatch<
    keyof Pl,
    "app" | "form" | "submission" | "errorBanner" | "chat" | "common"
  >
>;

type _FormFieldKeysExact = Expect<
  KeysMatch<
    keyof Pl["form"]["fields"],
    | "requestType"
    | "category"
    | "productName"
    | "purchaseDate"
    | "reason"
    | "image"
  >
>;

type _DecisionCategoryKeysMatchExportedType = Expect<
  KeysMatch<keyof Pl["chat"]["decisionBadge"], DecisionCategory>
>;

type _DecisionCategoriesAreExactlyTheFourPrdCategories = Expect<
  KeysMatch<DecisionCategory, "APPROVE" | "REJECT" | "MORE_INFO" | "ESCALATE">
>;

describe("Pl type (compile-time completeness, no `any`)", () => {
  it("type-checks the module's key sets and rules out `any` leaves", () => {
    // The assertions live entirely in the type layer above; referencing them
    // here just keeps this suite from being flagged as dead/unused code and
    // gives the check a visible, named place in the test report.
    const compiledTypeChecks: [
      _NoAnyInModule,
      _NoAnyInForm,
      _NoAnyInChat,
      _NoAnyInCommon,
      _NoAnyInCounterFnReturn,
      _TopLevelKeysExact,
      _FormFieldKeysExact,
      _DecisionCategoryKeysMatchExportedType,
      _DecisionCategoriesAreExactlyTheFourPrdCategories
    ] = [true, true, true, true, true, true, true, true, true];

    expect(compiledTypeChecks.every(Boolean)).toBe(true);
  });
});
