---
name: vm-memory-constraints
description: This training VM is frequently near-OOM (hundreds of stray node.exe processes); `next dev`/Turbopack can crash on first compile for reasons unrelated to app code
metadata:
  type: project
---

On this course VM, `Get-CimInstance Win32_OperatingSystem` typically shows only ~2.5 GB free out of 16 GB, and `Get-Process node` lists hundreds of `node.exe` processes (many at 20-70 MB working set each) — not processes this session started. `npm run dev` (Turbopack) reproducibly crashed twice in a row with `FATAL ERROR: ... JavaScript heap out of memory` / `Allocation failed` while compiling `/` for the first time during P0.4 (Play theme + full `ai-elements` install, which pulls in a heavy dep graph: motion, `@rive-app`, `@xyflow/react`, shiki, streamdown, etc.).

**Why:** The crash happens at very small V8 heap sizes (tens of MB), which points to OS-level physical memory exhaustion, not a V8 `--max-old-space-size` limit — so raising Node's heap flag won't fix it. This looks like a shared/multi-session resource constraint on the VM, not a defect in the app.

**How to apply:** Don't assume a `next dev` OOM crash means the code is broken — first confirm with `npm run build` (production compile + type-check + static generation), which succeeded cleanly in the same situation and is a strong substitute for the "app starts correctly" verification step when `next dev` itself can't be kept alive. Do not kill arbitrary `node.exe` processes to "free memory" — they likely belong to other course participants' sessions on this shared VM (per `AGENTS.md`: "Be careful with global machine changes"). If manual QA (Playwright) truly requires a live dev server, retry once or twice and, if it keeps OOM-ing, report it as an environment blocker rather than improvising workarounds.
