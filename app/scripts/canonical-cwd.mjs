#!/usr/bin/env node
// Re-exec the Next.js CLI from the filesystem's canonical-cased working
// directory.
//
// Windows' filesystem is case-insensitive, so a process can be launched with a
// cwd whose casing differs from the path's real on-disk casing (observed here:
// the tooling launches npm with "C:\Users\...\Dev\..." while the canonical
// casing is "...\DEV\..."). Next.js resolves some paths relative to cwd and
// others via the native realpath; when the two disagree only in casing, Node's
// module cache loads two copies of Next's internal modules. That splits the
// `workStore` AsyncLocalStorage singleton and makes `next build` fail static
// prerender of the built-in pages with:
//   InvariantError: Expected workStore to be initialized. This is a bug in Next.js.
//
// Running Next from the canonical cwd makes every resolution agree. On systems
// where the cwd casing already matches (Linux/CI, or a correctly-cased shell),
// `realpathSync.native` returns the same path, so this is a transparent
// passthrough.
import { realpathSync } from "node:fs";
import { spawn } from "node:child_process";

const canonicalCwd = realpathSync.native(process.cwd());
const args = process.argv.slice(2);

const child = spawn("next", args, {
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
