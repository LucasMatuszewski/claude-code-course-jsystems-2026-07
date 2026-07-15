/**
 * Next.js calls `register()` once when a new server instance starts, before any
 * request is handled (and it is skipped during `next build`). All Node-only
 * work (reading the repo-root `.env`, failing fast on a missing
 * `OPENROUTER_API_KEY`) lives in `instrumentation-node.ts`, imported lazily only
 * under the Node.js runtime. Keeping the Node APIs out of this file entirely
 * means the Edge Runtime bundle never statically sees `node:path`/`process.cwd`,
 * so the build produces no "Node.js API used in Edge Runtime" warnings.
 *
 * See: https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
