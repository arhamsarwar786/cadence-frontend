import { test, expect } from "@playwright/test";
import { apiLogin, DEMO, watchProblems } from "./helpers/auth";

/**
 * Whole-app crawl per persona: every route must render without an error
 * boundary / 404 / console error / unexpected API failure.
 */
const STATIC_STAFF = [
  "/", "/jobs", "/jobs/new", "/shifts", "/hour-sheets", "/invoices", "/invoices/new", "/credit-notes",
  "/payroll", "/workers", "/workers/new", "/clients", "/clients/new", "/perm-placements", "/tasks",
  "/documents", "/esign", "/candidate-imports", "/privacy", "/privacy/breaches", "/privacy/disposal",
  "/reports", "/audit", "/settings", "/admin/users", "/notifications/templates",
];
const DETAIL: Array<[string, string]> = [
  ["/jobs/", "/api/v1/jobs/"], ["/workers/", "/api/v1/workers/"], ["/clients/", "/api/v1/clients/"],
  ["/invoices/", "/api/v1/invoices/"], ["/credit-notes/", "/api/v1/credit-notes/"],
  ["/hour-sheets/", "/api/v1/hour-sheets/"], ["/tasks/", "/api/v1/tasks/"],
  ["/perm-placements/", "/api/v1/perm-placements/"], ["/payroll/runs/", "/api/v1/payroll/runs/"],
  ["/privacy/", "/api/v1/privacy/requests/"], ["/privacy/breaches/", "/api/v1/privacy/breaches/"],
  ["/candidate-imports/", "/api/v1/candidate-imports/"],
];
const PORTAL = [
  "/portal", "/portal/me", "/portal/me/contact", "/portal/me/skills", "/portal/me/certs", "/portal/me/education",
  "/portal/me/legacy", "/portal/me/time-off", "/portal/availability", "/portal/shifts", "/portal/offers",
  "/portal/documents", "/portal/signatures", "/portal/consent", "/portal/onboarding",
  "/portal/pay-statements",
];

const BAD_SCREEN = /Something went wrong|Application error|This page could not be found|Unhandled Runtime Error|404/i;

async function visit(page: import("@playwright/test").Page, path: string, out: string[]) {
  const p = watchProblems(page);
  const resp = await page.goto(path, { waitUntil: "networkidle" }).catch((e) => { out.push(`${path}: nav ${e}`); return null; });
  await page.waitForTimeout(400);
  const body = (await page.locator("body").innerText()).slice(0, 4000);
  const url = new URL(page.url()).pathname;
  const notes: string[] = [];
  if (resp && resp.status() >= 400) notes.push(`http ${resp.status()}`);
  if (BAD_SCREEN.test(body) && !/Notifications|No results/.test(body.slice(0, 0))) notes.push(`error-screen: ${body.match(BAD_SCREEN)![0]}`);
  if (url !== path.split("?")[0]) notes.push(`redirected -> ${url}`);
  // 403 (least-privilege persona hits a gated route) and 404 (optional sub-resource
  // such as a client with no billing row) are expected, handled responses — not crawl failures.
  const unexpectedApi = p.api.filter((a) => !/-> 40[34]$/.test(a));
  notes.push(...unexpectedApi.map((a) => `api ${a}`), ...p.console.map((c) => `console ${c}`), ...p.pageErrors.map((c) => `pageerror ${c}`));
  if (notes.length) out.push(`${path}\n    ${notes.join("\n    ")}`);
}

for (const [persona, login] of [["root admin", DEMO.root], ["coordinator", DEMO.recruiter]] as const) {
  test(`crawl staff routes as ${persona}`, async ({ page }) => {
    test.setTimeout(300_000);
    await apiLogin(page, login);
    const out: string[] = [];
    for (const r of STATIC_STAFF) await visit(page, r, out);
    for (const [route, api] of DETAIL) {
      const res = await page.request.get(`${api}?page_size=1`);
      if (res.status() === 403) { continue; } // least-privilege persona can't list this — expected
      if (!res.ok()) { out.push(`${route}[id] list ${api} -> ${res.status()}`); continue; }
      const j = await res.json();
      const id = (Array.isArray(j) ? j : j.results)?.[0]?.id;
      if (!id) { continue; }
      await visit(page, `${route}${id}`, out);
    }
    console.log(`\n=== ${persona} findings (${out.length}) ===\n${out.join("\n") || "none"}`);
    expect.soft(out, out.join("\n")).toEqual([]);
  });
}

test("crawl worker portal as worker", async ({ page }) => {
  test.setTimeout(240_000);
  await apiLogin(page, DEMO.worker);
  const out: string[] = [];
  for (const r of PORTAL) await visit(page, r, out);
  console.log(`\n=== worker findings (${out.length}) ===\n${out.join("\n") || "none"}`);
  expect.soft(out, out.join("\n")).toEqual([]);
});
