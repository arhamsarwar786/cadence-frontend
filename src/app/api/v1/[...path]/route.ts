import { type NextRequest, NextResponse } from "next/server";

/**
 * Same-origin browser calls, server-side fetch to Django.
 * Vercel rewrites to an external host drop/mis-attribute Set-Cookie, so
 * this route is the only API path — not next.config rewrites.
 */
const DJANGO_ORIGIN = (process.env.DJANGO_ORIGIN ?? "https://api.app-cadence.com").replace(
  /\/$/,
  "",
);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function csrfFromCookie(cookie: string | null): string | null {
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Bind Django cookies to this frontend host, not api.app-cadence.com. */
function rewriteSetCookie(header: string): string {
  const parts = header.split(";").map((part) => part.trim());
  const kept = parts.filter((part) => !/^domain=/i.test(part));
  const hasPath = kept.some((part) => /^path=/i.test(part));
  if (!hasPath) kept.push("Path=/");
  return kept.join("; ");
}

async function proxy(req: NextRequest, path: string[]) {
  const segments = path.filter(Boolean);
  const dest = new URL(`${DJANGO_ORIGIN}/api/v1/${segments.join("/")}/`);
  req.nextUrl.searchParams.forEach((value, key) => {
    dest.searchParams.set(key, value);
  });

  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const csrf = req.headers.get("x-csrftoken") ?? csrfFromCookie(cookie);
  if (csrf) headers.set("X-CSRFToken", csrf);

  const accept = req.headers.get("accept");
  if (accept) headers.set("Accept", accept);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  headers.set("Origin", DJANGO_ORIGIN);
  headers.set("Referer", `${DJANGO_ORIGIN}/`);

  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const upstream = await fetch(dest, {
    method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  const out = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
  });
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === "set-cookie" ||
      lower === "content-encoding" ||
      lower === "transfer-encoding" ||
      lower === "content-length"
    ) {
      return;
    }
    out.headers.set(key, value);
  });
  for (const setCookie of upstream.headers.getSetCookie()) {
    out.headers.append("set-cookie", rewriteSetCookie(setCookie));
  }
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

type RouteCtx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
