#!/usr/bin/env node
// Re-exec a command from the filesystem's canonical-cased working directory.
//
// Usage: node scripts/canonical-cwd.mjs <command> [args...]
//   e.g. node scripts/canonical-cwd.mjs next build
//        node scripts/canonical-cwd.mjs playwright test
//
// Windows' filesystem is case-insensitive, so a process can be launched with a
// cwd whose casing differs from the path's real on-disk casing (observed here:
// the tooling launches npm with "C:\Users\...\Dev\..." while the canonical
// casing is "...\DEV\..."). Tools that resolve some paths relative to cwd and
// others via the native realpath then load two copies of the same module when
// the two disagree only in casing. Two symptoms seen here:
//   - Next.js: split `workStore` AsyncLocalStorage singleton →
//     `next build` fails static prerender with
//     "InvariantError: Expected workStore to be initialized".
//   - Playwright: two instances of `@playwright/test` →
//     "test.describe() did not expect to be called here / two different
//     versions of @playwright/test".
//
// Running from the canonical cwd makes every resolution agree. On systems where
// the cwd casing already matches (Linux/CI, or a correctly-cased shell),
// `realpathSync.native` returns the same path, so this is a transparent
// passthrough.
import { realpathSync } from "node:fs";
import { spawn } from "node:child_process";

const canonicalCwd = realpathSync.native(process.cwd());
const argv = process.argv.slice(2);

if (argv.length === 0) {
  console.error("canonical-cwd.mjs: missing command to run");
  process.exit(1);
}

// Pass the whole invocation as a single shell string (rather than a command +
// args array) so Node does not emit DEP0190 for `shell: true` with args. These
// args come only from our own package.json scripts, so concatenation is safe.
const child = spawn(argv.join(" "), {
  cwd: canonicalCwd,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
