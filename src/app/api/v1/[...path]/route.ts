import { Resolver } from "node:dns/promises";
import https from "node:https";
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
export const runtime = "nodejs";

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

function isDnsFailure(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const cause =
    error instanceof Error && "cause" in error && error.cause instanceof Error
      ? error.cause.message
      : "";
  const code =
    error instanceof Error && "cause" in error && error.cause && typeof error.cause === "object"
      ? String((error.cause as { code?: string }).code ?? "")
      : "";
  const text = `${msg} ${cause} ${code}`;
  return (
    text.includes("ENOTFOUND") ||
    text.includes("getaddrinfo") ||
    text.includes("EAI_AGAIN")
  );
}

/** Router DNS on some LAN setups SERVFAILs this host; public resolvers still work. */
async function resolveIpv4(hostname: string): Promise<string | null> {
  const resolver = new Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  try {
    const ips = await resolver.resolve4(hostname);
    return ips[0] ?? null;
  } catch {
    return null;
  }
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** HTTPS request to an IP with SNI = real hostname (cert still verifies). */
function httpsViaIp(
  dest: URL,
  ip: string,
  init: { method: string; headers: Headers; body?: Uint8Array },
): Promise<Response> {
  const pathWithQuery = `${dest.pathname}${dest.search}`;
  const headers = headersToObject(init.headers);
  headers.host = dest.hostname;
  const bodyBuf = init.body?.length ? Buffer.from(init.body) : undefined;
  if (bodyBuf) headers["content-length"] = String(bodyBuf.length);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: ip,
        servername: dest.hostname,
        port: dest.port ? Number(dest.port) : 443,
        path: pathWithQuery,
        method: init.method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const outHeaders = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value == null) continue;
            if (key.toLowerCase() === "set-cookie") {
              const cookies = Array.isArray(value) ? value : [value];
              for (const cookie of cookies) outHeaders.append("set-cookie", cookie);
              continue;
            }
            outHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
          }
          resolve(
            new Response(buf, {
              status: res.statusCode ?? 502,
              statusText: res.statusMessage,
              headers: outHeaders,
            }),
          );
        });
      },
    );
    req.on("error", reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

async function upstreamFetch(
  dest: URL,
  init: {
    method: string;
    headers: Headers;
    body?: Uint8Array;
  },
): Promise<Response> {
  try {
    return await fetch(dest, {
      method: init.method,
      headers: init.headers,
      body: init.body?.length ? Buffer.from(init.body) : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (error) {
    if (!isDnsFailure(error)) throw error;

    const ip = await resolveIpv4(dest.hostname);
    if (!ip) throw error;

    console.warn(
      `[api proxy] system DNS failed for ${dest.hostname}; retrying via ${ip} (8.8.8.8)`,
    );
    return httpsViaIp(dest, ip, init);
  }
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
  let body: Uint8Array | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const raw = await req.text();
    body = raw.length > 0 ? new TextEncoder().encode(raw) : undefined;
  }

  let upstream: Response;
  try {
    upstream = await upstreamFetch(dest, { method, headers, body });
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    const detail = isDnsFailure(cause)
      ? `Can't resolve API host ${DJANGO_ORIGIN}. Check DNS (or set DJANGO_ORIGIN).`
      : `Can't reach API at ${DJANGO_ORIGIN}: ${cause.message}`;
    console.error("[api proxy]", detail, cause);
    return NextResponse.json({ detail }, { status: 502 });
  }

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
  const getSetCookie = (
    upstream.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const setCookies =
    typeof getSetCookie === "function"
      ? getSetCookie.call(upstream.headers)
      : upstream.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookies) {
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
