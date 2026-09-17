import type { NextConfig } from "next";

// Browser calls stay on this host (`/api/v1/*`). The App Router proxy in
// `src/app/api/v1/[...path]/route.ts` forwards to Django so session cookies
// and CSRF work when the API is https://api.app-cadence.com. Do not add a
// rewrite to that host — Vercel external rewrites do not keep Set-Cookie
// on the frontend domain, which makes every authenticated call 403.
const nextConfig: NextConfig = {
  agentRules: false,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
