import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native Node module; keep it external to the server
  // bundle so it loads via native `require` instead of being bundled.
  // See ADR-003 D3-01.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
