---
name: project-zod-v4-error-api
description: Zod v4.4.3 (installed in app/) uses `{ error: () => msg }` instead of `{ message: msg }` for custom validation messages; z.iso.date() is the ISO date validator.
metadata:
  type: project
---

This repo's `app/package.json` pins `zod: "^4.4.3"`. Custom error messages use the v4
`error` option, not the old `message` option:

```ts
z.enum(["a", "b"], { error: () => "custom message" })
z.string({ error: () => "msg" }).min(1, { error: () => "msg" })
z.iso.date({ error: () => "msg" }).refine(fn, { error: () => "msg" })
```

Notes confirmed by direct testing (`node -e` against the installed package):
- For `z.enum`, both a missing value (`undefined`) and an invalid value produce the
  same issue code (`invalid_value`) — one `error` message covers both cases.
- For `z.string()`, missing (`undefined`) is `invalid_type` and empty string is
  `too_small` — these are two different validator calls, so set `error` on both
  the base `z.string({...})` AND `.min(1, {...})` if one message should cover both.
- `z.object(shape, { error: () => msg })` — the object-level `error` fires when the
  whole value is missing/not-an-object (e.g. the field itself is `undefined`),
  distinct from per-field errors inside `shape`.
- `z.iso.date({...})` covers required + malformed-format with one message; chain
  `.refine(...)` for extra semantic checks (e.g. not-in-the-future) with its own message.

**Why:** the project's TDD rules require every Zod rejection to carry an exact Polish
string from `lib/copy/pl.ts` — getting the message API wrong silently falls back to
Zod's default English message, which would violate AC-50 without failing type-check.

**How to apply:** when writing any new Zod schema in this project (e.g. P1.5 AI
layer schemas, later API route validation), use the `error` callback form above, and
verify required-vs-invalid message coverage with a quick `node -e` check before writing
the schema for real if the shape is non-trivial — don't guess from pre-v4 Zod docs
memorized in training data.
