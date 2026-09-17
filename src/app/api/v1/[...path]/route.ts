import { type NextRequest, NextResponse } from "next/server";

/**
 * Server proxy to Django. Browser calls stay same-origin on this host so
 * session cookies stick; Origin is rewritten to the API host so Django's
 * CSRF check does not treat Vercel as a cross-site POST.
 */
const DJANGO_ORIGIN = (process.env.DJANGO_ORIGIN ?? "https://api.app-cadence.com").replace(
  /\/$/,
  "",
);

function csrfFromCookie(cookie: string | null): string | null {
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function proxy(req: NextRequest, path: string[]) {
  const dest = new URL(`${DJANGO_ORIGIN}/api/v1/${path.join("/")}/`);
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
    redirect: "manual",
  });

  const out = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
  });
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "set-cookie" || lower === "content-encoding" || lower === "transfer-encoding") {
      return;
    }
    out.headers.set(key, value);
  });
  for (const setCookie of upstream.headers.getSetCookie()) {
    out.headers.append("set-cookie", setCookie);
  }
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
