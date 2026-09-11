import type { NextConfig } from "next";

// The Django origin this dev server proxies to. Same-origin in the browser
// either way: in dev, Next rewrites /api/v1/* to Django on another port;
// in production, a reverse proxy serves both from one origin instead — see
// ARCHITECTURE.md §2.1. Session cookie + CSRF depend on this staying
// same-origin from the browser's point of view, so this is a rewrite, never
// a client-side fetch to a different host.
const DJANGO_ORIGIN = process.env.DJANGO_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // This repo already has a root AGENTS.md/CLAUDE.md governing the whole
  // monorepo (plus this app's own ARCHITECTURE.md) — Next's auto-generated
  // per-directory copies would just be a second, conflicting source.
  agentRules: false,
  // Every Django path ends in a trailing slash (openapi.json, throughout).
  // Next's own trailing-slash redirect runs BEFORE rewrites and would strip
  // it on every /api/v1/* call, bouncing through an extra redirect that
  // Django's APPEND_SLASH then adds right back. This only turns off Next's
  // own slash handling — app page routes are unaffected.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        // :path* itself never carries a trailing slash (Next reconstructs
        // it from matched segments), so appending "/" here unconditionally
        // is what makes both "/api/v1/health" and "/api/v1/health/" reach
        // Django's true door — omitting it sends Django a slash-less path
        // on EVERY call, which Django then 301s back to add, and a real
        // fetch() would follow that back into this same rewrite forever.
        source: "/api/v1/:path*",
        destination: `${DJANGO_ORIGIN}/api/v1/:path*/`,
      },
    ];
  },
};

export default nextConfig;
