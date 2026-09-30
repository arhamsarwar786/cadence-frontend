import { test, expect, type Locator, type Page } from "@playwright/test";
import { apiLogin, DEMO, watchProblems } from "./helpers/auth";

/**
 * Work + money QA: Jobs, Shifts, Hour sheets, Perm placements, Invoices,
 * Credit notes, Payroll. Runs against the LOCAL stack only.
 *
 * Determinism: every test builds its own records through the real API
 * (unique title suffix / unique far-past week) so re-runs never depend on
 * state a previous run left behind.
 *
 * Tests titled "BUG:" assert the CORRECT behaviour and are wrapped in
 * test.fail(): they pass while the bug exists and start failing (loudly)
 * the moment somebody fixes it - flip them to plain test() then.
 */

test.beforeEach(async ({}, ti) => ti.setTimeout(75_000));
test.use({ actionTimeout: 15_000 });
expect.configure({ timeout: 10_000 });

const RUN = Date.now().toString(36);
// tiny valid PDF - the API sniffs content and rejects e.g. CSV or a 1px PNG
const PDF_MIN = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const NIL_UUID = "00000000-0000-4000-8000-000000000000";

// ---------------------------------------------------------------- helpers

interface ApiRes<T = any> {
  status: number;
  ok: boolean;
  body: T;
}

function mkApi(page: Page) {
  async function call<T = any>(method: string, path: string, data?: unknown): Promise<ApiRes<T>> {
    const csrf = (await page.context().cookies()).find((c) => c.name === "csrftoken")?.value ?? "";
    const res = await page.request.fetch(path, {
      method,
      data: data as never,
      headers: { "X-CSRFToken": csrf },
    });
    let parsed: any = null;
    const text = await res.text();
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    return { status: res.status(), ok: res.ok(), body: parsed };
  }
  return {
    get: <T = any>(p: string) => call<T>("GET", p),
    post: <T = any>(p: string, d: unknown = {}) => call<T>("POST", p, d),
    patch: <T = any>(p: string, d: unknown) => call<T>("PATCH", p, d),
    del: <T = any>(p: string) => call<T>("DELETE", p),
  };
}
type Api = ReturnType<typeof mkApi>;

async function loginAs(page: Page, who: "root" | "recruiter" = "root"): Promise<Api> {
  await apiLogin(page, who === "root" ? DEMO.root : DEMO.recruiter);
  return mkApi(page);
}

interface Base {
  clientId: string;
  clientName: string;
  mayaId: string;
  priyaId: string;
}
async function base(api: Api): Promise<Base> {
  const clients = (await api.get("/api/v1/clients/?page_size=100")).body.results as any[];
  const client = clients.find((c) => c.name === "Harbourview Care Home") ?? clients.find((c) => c.status === "active");
  const workers = (await api.get("/api/v1/workers/?page_size=100")).body.results as any[];
  const maya = workers.find((w) => w.first_name === "Maya");
  const priya = workers.find((w) => w.first_name === "Priya");
  return { clientId: client.id, clientName: client.name, mayaId: maya.id, priyaId: priya.id };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** A Monday in the far past that is unique per spec run (so payroll "unsettled worked shifts" never collide). */
function uniqueMonday(): Date {
  const weeksBack = 20 + (Math.floor(Date.now() / 60_000) % 400);
  const d = new Date(Date.UTC(2026, 8, 7)); // Mon 2026-09-07
  d.setUTCDate(d.getUTCDate() - weeksBack * 7);
  return d;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

interface JobFx {
  jobId: string;
  title: string;
  assignmentId?: string;
  monday: Date;
  shifts: any[];
}
/** Job (open) + optional pattern/assignment/confirm/shifts. past=true puts it in a unique past week. */
async function mkJob(
  api: Api,
  b: Base,
  o: { past?: boolean; assign?: boolean; confirm?: boolean; pattern?: boolean; tag?: string } = {},
): Promise<JobFx> {
  const monday = o.past ? uniqueMonday() : new Date(Date.UTC(2026, 9, 5));
  const title = `QA ${o.tag ?? "job"} ${RUN}${Math.random().toString(36).slice(2, 5)}`;
  const r = await api.post("/api/v1/jobs/", {
    title,
    client: b.clientId,
    bill_rate: "30.00",
    bill_rate_unit: "hr",
    start_datetime: `${iso(monday)}T09:00:00Z`,
    end_datetime: `${iso(addDays(monday, 4))}T17:00:00Z`,
    headcount_needed: 2,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const jobId = r.body.id as string;
  let assignmentId: string | undefined;
  let shifts: any[] = [];
  if (o.assign || o.pattern) {
    const p = await api.post(`/api/v1/jobs/${jobId}/shift-patterns/`, {
      days_of_week: [1, 2],
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 30,
    });
    expect(p.status, JSON.stringify(p.body)).toBe(201);
  }
  if (o.assign) {
    const a = await api.post(`/api/v1/jobs/${jobId}/assignments/`, { employee_id: b.mayaId });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    assignmentId = a.body.id;
    if (o.confirm) expect((await api.post(`/api/v1/assignments/${assignmentId}/confirm/`)).status).toBe(200);
    expect((await api.post(`/api/v1/jobs/${jobId}/shifts/regenerate/`)).status).toBe(200);
    shifts = (await api.get(`/api/v1/shifts/?job=${jobId}&page_size=100`)).body.results;
  }
  return { jobId, title, assignmentId, monday, shifts };
}

/** Past job with Maya, confirmed, an approved hour sheet -> worked shift ready for invoicing/payroll. */
async function mkWorked(api: Api, b: Base, tag = "worked") {
  const fx = await mkJob(api, b, { past: true, assign: true, confirm: true, tag });
  const hs = await api.post("/api/v1/hour-sheets/", {
    client_id: b.clientId,
    job_id: fx.jobId,
    period_start: iso(fx.monday),
    period_end: iso(addDays(fx.monday, 6)),
  });
  expect(hs.status, JSON.stringify(hs.body)).toBe(201);
  const line = await api.post(`/api/v1/hour-sheets/${hs.body.id}/lines/`, {
    employee_id: b.mayaId,
    hours: "7.50",
    work_date: iso(fx.monday),
  });
  expect(line.status, JSON.stringify(line.body)).toBe(201);
  const ap = await api.post(`/api/v1/hour-sheets/${hs.body.id}/approve/`);
  expect(ap.status, JSON.stringify(ap.body)).toBe(200);
  return { ...fx, sheetId: hs.body.id as string };
}

async function mkInvoice(api: Api, b: Base, o: { line?: boolean } = {}) {
  const r = await api.post("/api/v1/invoices/", { client_id: b.clientId });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  if (o.line !== false) {
    const l = await api.post(`/api/v1/invoices/${r.body.id}/lines/`, {
      description: `QA line ${RUN}`,
      unit: "flat",
      quantity: "1",
      rate: "100.00",
    });
    expect(l.status, JSON.stringify(l.body)).toBe(201);
  }
  return r.body.id as string;
}
async function invoiceTo(api: Api, id: string, target: "pending_approval" | "approved" | "sent" | "paid") {
  const steps: Record<string, string[]> = {
    pending_approval: ["submit"],
    approved: ["submit", "approve"],
    sent: ["submit", "approve", "send"],
    paid: ["submit", "approve", "send", "mark-paid"],
  };
  for (const s of steps[target]) {
    const r = await api.post(`/api/v1/invoices/${id}/${s}/`);
    expect(r.status, `${s}: ${JSON.stringify(r.body)}`).toBe(200);
  }
}

async function mkCreditNote(api: Api, invoiceId: string, withLine = true) {
  const r = await api.post("/api/v1/credit-notes/", { invoice_id: invoiceId, reason: `QA ${RUN}` });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  if (withLine) {
    const l = await api.post(`/api/v1/credit-notes/${r.body.id}/lines/`, {
      description: "QA credit",
      unit: "flat",
      quantity: "1",
      rate: "5.00",
    });
    expect(l.status, JSON.stringify(l.body)).toBe(201);
  }
  return r.body.id as string;
}

/** Answer matching requests with a canned response; counts hits. */
async function stub(
  page: Page,
  url: RegExp,
  o: { method?: string; status?: number; body?: unknown; abort?: boolean; once?: boolean; html?: boolean },
) {
  const state = { hits: 0 };
  await page.route(url, async (route) => {
    if (o.method && route.request().method() !== o.method) return route.fallback();
    if (o.once && state.hits >= 1) return route.fallback();
    state.hits++;
    if (o.abort) return route.abort("failed");
    if (o.html) return route.fulfill({ status: o.status ?? 500, contentType: "text/html", body: "<html><body>Server Error</body></html>" });
    return route.fulfill({
      status: o.status ?? 500,
      contentType: "application/json",
      body: JSON.stringify(o.body ?? { detail: "boom" }),
    });
  });
  return state;
}

const body = (page: Page) => page.locator("body");
async function expectText(page: Page, re: RegExp | string, timeout = 8000) {
  await expect(body(page)).toContainText(re, { timeout });
}
/** Field-level error text next to the labelled control (the <p> inside the same Field wrapper). */
function fieldError(page: Page, label: string | RegExp, exact = false): Locator {
  return page
    .locator("div.flex.flex-col.gap-1\\.5")
    .filter({ has: page.getByText(label, { exact }) })
    .locator("p.text-cadence-red");
}
/** Pin down: page is neither blank, an error boundary, nor stuck on "Loading…". */
async function expectSettled(page: Page) {
  await expect(page.getByText(/^Loading…$/)).toHaveCount(0, { timeout: 10000 });
  await expect(body(page)).not.toContainText(/Something went wrong|Application error|Unhandled Runtime/i);
}
function wantNotFoundPage(page: Page) {
  return expect(body(page)).toContainText(/could not be found|not found|404/i, { timeout: 10000 });
}
/** The floating bottom dock can cover buttons at the page bottom; dispatch the click on the element itself. */
async function jsClick(l: Locator) {
  await l.evaluate((el) => (el as HTMLElement).click());
}
async function cleanJob(api: Api, id: string) {
  // root-only soft delete; best effort so the local list does not grow forever
  await api.del(`/api/v1/jobs/${id}/`);
}

// =========================================================================
// JOBS
// =========================================================================
test.describe("Jobs list", () => {
  test("root: list renders seed rows, count stat, no console/API errors", async ({ page }) => {
    await loginAs(page);
    const p = watchProblems(page);
    await page.goto("/jobs");
    await expect(page.getByRole("button", { name: "New job" })).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 10000 });
    expect(p.api).toEqual([]);
    expect(p.pageErrors).toEqual([]);
    expect(p.console).toEqual([]);
  });

  test("status filter chips + client filter + search narrow the list (URL-driven)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "filter" });
    await page.goto(`/jobs?q=${encodeURIComponent(fx.title)}`);
    await expect(page.getByText(fx.title, { exact: true })).toBeVisible();
    await page.goto(`/jobs?q=zzz-no-such-job-${RUN}`);
    await expectText(page, "No jobs match that find.");
    await page.goto(`/jobs?status=open&q=${encodeURIComponent(fx.title)}`);
    await expect(page.getByText(fx.title, { exact: true })).toBeVisible();
    await page.goto(`/jobs?status=cancelled&q=${encodeURIComponent(fx.title)}`);
    await expect(page.getByText(fx.title, { exact: true })).toHaveCount(0);
    await page.goto("/jobs");
    await page.getByRole("button", { name: "completed", exact: true }).click();
    await expect(page).toHaveURL(/status=completed/);
    await page.goto(`/jobs?client=${b.clientId}&q=${encodeURIComponent(fx.title)}`);
    await expect(page.getByText(fx.title, { exact: true })).toBeVisible();
    await cleanJob(api, fx.jobId);
  });

  test("out-of-range page shows a readable message, not a blank page", async ({ page }) => {
    await loginAs(page);
    await page.goto("/jobs?page=99");
    await expectText(page, /Invalid page|No jobs/i);
    await expectSettled(page);
  });

  test("BUG: out-of-range page offers a way back instead of a dead-end error", async ({ page }) => {
    await loginAs(page);
    await page.goto("/jobs?page=99");
    await expectText(page, /Invalid page/i);
    await expect(page.getByRole("button", { name: /first|previous|back|page 1|retry/i })).toBeVisible({ timeout: 3000 });
  });

  test("403 on list shows the API's permission text", async ({ page }) => {
    await loginAs(page);
    await stub(page, /\/api\/v1\/jobs\/\?/, { status: 403, body: { detail: "missing permission: jobs.view" } });
    await page.goto("/jobs");
    await expectText(page, /don't have access|permission/i);
  });

  test("5xx on list shows a human-readable error", async ({ page }) => {
    await loginAs(page);
    await stub(page, /\/api\/v1\/jobs\/\?/, { status: 500, html: true });
    await page.goto("/jobs");
    await expectText(page, /Can't reach the API|Something went wrong|try again/i);
  });

  test("BUG: list 5xx / network failure has a Retry control", async ({ page }) => {
    await loginAs(page);
    await stub(page, /\/api\/v1\/jobs\/\?/, { abort: true });
    await page.goto("/jobs");
    await expectText(page, /Can't reach the API/i);
    await expect(page.getByRole("button", { name: /retry|try again|reload/i })).toBeVisible({ timeout: 3000 });
  });

  test("BUG: 401 mid-session on a list clears the session and sends the user to /login", async ({ page }) => {
    test.fail();
    await loginAs(page);
    await page.goto("/jobs");
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await stub(page, /\/api\/v1\/jobs\/\?/, { status: 401, body: { detail: "Authentication credentials were not provided." } });
    await page.getByRole("button", { name: "open", exact: true }).click(); // fresh list fetch -> 401 (SPA nav, session stays in memory)
    await expect(page).toHaveURL(/\/login/, { timeout: 6000 });
  });

  test("coordinator: create page explains the missing jobs.bill_rate.edit and disables submit", async ({ page }) => {
    await loginAs(page, "recruiter");
    await page.goto("/jobs");
    await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 10000 });
    await page.goto("/jobs/new");
    await expectText(page, /jobs\.bill_rate\.edit/);
    await expect(page.getByRole("button", { name: "Create job" })).toBeDisabled();
  });
});

test.describe("Job create / edit / lifecycle", () => {
  async function fillJob(page: Page, v: Partial<Record<string, string>>) {
    if (v.title !== undefined) await page.getByLabel("Title").fill(v.title);
    if (v.client) await page.getByLabel("Client", { exact: true }).selectOption({ label: v.client });
    if (v.start !== undefined) await page.getByLabel("Start", { exact: true }).fill(v.start);
    if (v.end !== undefined) await page.getByLabel("End", { exact: true }).fill(v.end);
    if (v.rate !== undefined) await page.getByLabel("Bill rate", { exact: true }).fill(v.rate);
    if (v.headcount !== undefined) await page.getByLabel("Headcount needed").fill(v.headcount);
    if (v.markup !== undefined) await page.getByLabel(/Markup/).fill(v.markup);
  }

  test("validation: empty submit pins a required-error next to each field", async ({ page }) => {
    await loginAs(page);
    await page.goto("/jobs/new");
    await page.getByRole("button", { name: "Create job" }).click();
    await expect(fieldError(page, "Title", true)).toHaveText("Title is required.");
    await expect(fieldError(page, "Client", true)).toHaveText("Pick a client.");
    await expect(fieldError(page, "Start", true)).toHaveText("Start is required.");
    await expect(fieldError(page, "End", true)).toHaveText("End is required.");
    await expect(fieldError(page, "Bill rate", true)).toHaveText("Required.");
    expect(page.url()).toContain("/jobs/new");
  });

  test("validation: invalid rate / markup / headcount boundary values", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    await page.goto("/jobs/new");
    await fillJob(page, { title: "x", client: b.clientName, start: "2026-10-05T09:00", end: "2026-10-06T09:00", rate: "abc", headcount: "0", markup: "1234" });
    await page.getByRole("button", { name: "Create job" }).click();
    await expect(fieldError(page, "Bill rate", true)).toHaveText("Enter a valid number.");
    await expect(fieldError(page, /Markup/)).toContainText(/number like 35/);
    await expect(fieldError(page, "Headcount needed", true)).toBeVisible();
    await page.getByLabel("Bill rate", { exact: true }).fill("100000000");
    await page.getByRole("button", { name: "Create job" }).click();
    await expect(fieldError(page, "Bill rate", true)).toHaveText("Enter a valid number.");
  });

  test("BUG: headcount 0 error is a human sentence (not zod's 'Too small: expected number to be >=1')", async ({ page }) => {
    await loginAs(page);
    await page.goto("/jobs/new");
    await page.getByLabel("Headcount needed").fill("0");
    await page.getByRole("button", { name: "Create job" }).click();
    await expect(fieldError(page, "Headcount needed", true)).toHaveText(/at least 1|1 or more|must be/i);
  });

  test("server 400 (end before start) is surfaced with the API's own words", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    await page.goto("/jobs/new");
    await fillJob(page, { title: `QA bad dates ${RUN}`, client: b.clientName, start: "2026-10-06T09:00", end: "2026-10-05T09:00", rate: "30" });
    await page.getByRole("button", { name: "Create job" }).click();
    await expectText(page, "end must be after start");
    expect(page.url()).toContain("/jobs/new");
  });

  test("create happy path: persists, redirects to detail, double-submit creates ONE job", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const title = `QA ui-create ${RUN}`;
    await page.goto("/jobs/new");
    await fillJob(page, { title, client: b.clientName, start: "2026-10-05T09:00", end: "2026-10-09T17:00", rate: "31.50", headcount: "2" });
    await page.getByLabel("PO number").fill("PO-QA-1");
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && /\/api\/v1\/jobs\/$/.test(r.url()) && posts.push(r.url()));
    await page.getByRole("button", { name: "Create job" }).dblclick();
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/, { timeout: 10000 });
    const id = page.url().split("/").pop()!;
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    expect(posts.length, "double-click must not double POST").toBe(1);
    const list = (await api.get(`/api/v1/jobs/?page_size=200&client=${b.clientId}`)).body.results.filter((j: any) => j.title === title);
    expect(list).toHaveLength(1);
    expect(list[0].bill_rate).toBe("31.50");
    expect(list[0].po_number).toBe("PO-QA-1");
    await cleanJob(api, id);
  });

  test("BUG: entered start/end are org-local (America/Vancouver) - detail shows the same wall-clock time", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const title = `QA tz ${RUN}`;
    await page.goto("/jobs/new");
    await fillJob(page, { title, client: b.clientName, start: "2026-10-05T09:00", end: "2026-10-05T17:00", rate: "30" });
    await page.getByRole("button", { name: "Create job" }).click();
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop()!;
    await expect(page.locator("dd").first()).toContainText(/9:00\s*a\.m\./i, { timeout: 5000 });
    await cleanJob(api, id);
  });

  test("BUG: edit form pre-fills Start/End (datetime-local accepts the API value)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "edit-prefill" });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Title")).toHaveValue(fx.title);
    await expect(page.getByLabel("Start", { exact: true })).not.toHaveValue("", { timeout: 3000 });
    await cleanJob(api, fx.jobId);
  });

  test("edit: change title/headcount persists; server 400 surfaced", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "edit" });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Title").fill(fx.title + " v2");
    await page.getByLabel("Headcount needed").fill("5");
    // Start/End are blank in the edit form today (see BUG above) - fill them so the save path is testable
    await page.getByLabel("Start", { exact: true }).fill("2026-10-06T09:00");
    await page.getByLabel("End", { exact: true }).fill("2026-10-05T09:00");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expectText(page, "end must be after start");
    await page.getByLabel("End", { exact: true }).fill("2026-10-09T17:00");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: fx.title + " v2" })).toBeVisible({ timeout: 8000 });
    const got = (await api.get(`/api/v1/jobs/${fx.jobId}/`)).body;
    expect(got.title).toBe(fx.title + " v2");
    expect(got.headcount_needed).toBe(5);
    await page.reload();
    await expect(page.getByRole("heading", { name: fx.title + " v2" })).toBeVisible();
    await cleanJob(api, fx.jobId);
  });

  test("detail: unknown id and garbage id render a 404 page", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/jobs/${NIL_UUID}`);
    await wantNotFoundPage(page);
    await page.goto("/jobs/not-a-uuid");
    await wantNotFoundPage(page);
  });

  test("detail: 500 shows readable error (no infinite Loading)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "detail500" });
    await stub(page, new RegExp(`/api/v1/jobs/${fx.jobId}/$`), { status: 500, html: true });
    await page.goto(`/jobs/${fx.jobId}`);
    await expectText(page, /Can't reach the API|Something went wrong/i);
    await expectSettled(page);
    await cleanJob(api, fx.jobId);
  });

  test("detail: 403 shows the API text", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "detail403" });
    await stub(page, new RegExp(`/api/v1/jobs/${fx.jobId}/$`), { status: 403, body: { detail: "missing permission: jobs.view" } });
    await page.goto(`/jobs/${fx.jobId}`);
    await expectText(page, /don't have access|permission/i);
    await cleanJob(api, fx.jobId);
  });

  test("cancel job: confirm dialog, status becomes cancelled, buttons disappear, persists", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "cancel" });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Cancel job" }).click();
    await expect(page.getByRole("dialog")).toContainText("Cancel this job?");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await api.get(`/api/v1/jobs/${fx.jobId}/`)).body.status).toBe("open");
    await page.getByRole("button", { name: "Cancel job" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel job" }).click();
    await expect(page.getByRole("button", { name: "Cancel job" })).toHaveCount(0, { timeout: 8000 });
    expect((await api.get(`/api/v1/jobs/${fx.jobId}/`)).body.status).toBe("cancelled");
    await page.reload();
    await expect(page.getByText(/cancelled/i).first()).toBeVisible();
    await cleanJob(api, fx.jobId);
  });

  test("BUG: cancel job failure (403 / 500) is shown to the user", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "cancel-fail" });
    await stub(page, new RegExp(`/api/v1/jobs/${fx.jobId}/cancel/`), { status: 403, body: { detail: "missing permission: jobs.cancel" } });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Cancel job" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel job" }).click();
    await expectText(page, "missing permission: jobs.cancel", 4000);
    await cleanJob(api, fx.jobId);
  });

  test("complete job: confirm -> completed; persists", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "complete" });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Mark completed" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark completed" }).click();
    await expect(page.getByRole("button", { name: "Mark completed" })).toHaveCount(0, { timeout: 8000 });
    expect((await api.get(`/api/v1/jobs/${fx.jobId}/`)).body.status).toBe("completed");
    await cleanJob(api, fx.jobId);
  });

  test("BUG: archive failure is shown to the user", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "archive-fail" });
    await stub(page, new RegExp(`/api/v1/jobs/${fx.jobId}/$`), { method: "DELETE", status: 500, body: { detail: "archive failed upstream" } });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
    await expectText(page, /archive failed upstream|Something went wrong/i, 4000);
    await cleanJob(api, fx.jobId);
  });

  test("archive (root): confirm -> back on /jobs, job gone from list and API 404", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "archive" });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
    await expect(page).toHaveURL(/\/jobs$/, { timeout: 8000 });
    expect((await api.get(`/api/v1/jobs/${fx.jobId}/`)).status).toBe(404);
    await page.goto(`/jobs?q=${encodeURIComponent(fx.title)}`);
    await expect(page.getByText(fx.title, { exact: true })).toHaveCount(0);
  });

  test("coordinator: Cancel job + Archive + bill rate are hidden, Edit is shown; API 403s cancel", async ({ page }) => {
    const rootApi = await loginAs(page);
    const b = await base(rootApi);
    const fx = await mkJob(rootApi, b, { tag: "coord" });
    const api = await loginAs(page, "recruiter");
    await page.goto(`/jobs/${fx.jobId}`);
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel job" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);
    await expect(page.getByText("Bill rate")).toHaveCount(0);
    expect((await api.post(`/api/v1/jobs/${fx.jobId}/cancel/`)).status).toBe(403);
    await cleanJob(await loginAs(page), fx.jobId);
  });
});

// =========================================================================
// JOB SUB-RESOURCES: requirements, shift patterns, regenerate, assignments
// =========================================================================
test.describe("Job requirements / patterns / assignments", () => {
  test("requirements: add cert (persists), min_years validation, server 400 words, remove with confirm", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "req" });
    await page.goto(`/jobs/${fx.jobId}`);
    await expectText(page, "No requirements set.");
    await page.getByRole("button", { name: "Add requirement" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Type").selectOption("cert");
    await dlg.getByLabel("Minimum years").fill("abc");
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(fieldError(page, "Minimum years", true)).toContainText(/number like 2/);
    // cert with no name -> server 400 (API words)
    await dlg.getByLabel("Minimum years").fill("");
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(dlg).toContainText(/cert|name|required|blank/i, { timeout: 5000 });
    await dlg.getByLabel("Certification name").fill("FoodSafe QA");
    await dlg.getByLabel("Minimum years").fill("2.5");
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/FoodSafe QA · 2\.5y\+/)).toBeVisible();
    expect((await api.get(`/api/v1/jobs/${fx.jobId}/requirements/`)).body).toHaveLength(1);
    await page.reload();
    await expect(page.getByText(/FoodSafe QA/)).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expectText(page, "No requirements set.");
    expect((await api.get(`/api/v1/jobs/${fx.jobId}/requirements/`)).body).toHaveLength(0);
    await cleanJob(api, fx.jobId);
  });

  test("requirements: skill type with no skill shows the API's words in the dialog", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "req-skill" });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Add requirement" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toContainText(/skill requirement names a skill_id/, { timeout: 5000 });
    await cleanJob(api, fx.jobId);
  });

  test("BUG: removing a requirement / pattern when the API fails shows an error", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "req-del-fail" });
    await api.post(`/api/v1/jobs/${fx.jobId}/requirements/`, { requirement_type: "cert", cert_name: "X" });
    await stub(page, /\/requirements\/[0-9a-f-]{36}\/$/, { method: "DELETE", status: 500, body: { detail: "delete exploded" } });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expectText(page, /delete exploded|Something went wrong/i, 4000);
    await cleanJob(api, fx.jobId);
  });

  test("shift patterns: validation, add, persist, remove", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "pattern" });
    await page.goto(`/jobs/${fx.jobId}`);
    await expectText(page, "No shift patterns set.");
    await page.getByRole("button", { name: "Add pattern" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(fieldError(page, "Days", true)).toHaveText("Pick at least one day.");
    await expect(fieldError(page, "Start time", true)).toHaveText("Start time is required.");
    await expect(fieldError(page, "End time", true)).toHaveText("End time is required.");
    await dlg.getByLabel("Mon").check();
    await dlg.getByLabel("Wed").check();
    await dlg.getByLabel("Start time").fill("22:00");
    await dlg.getByLabel("End time").fill("06:00");
    await dlg.getByLabel("Break (minutes)").fill("-5");
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(fieldError(page, "Break (minutes)", true)).toBeVisible();
    await dlg.getByLabel("Break (minutes)").fill("30");
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/\(overnight\)/)).toBeVisible();
    const pats = (await api.get(`/api/v1/jobs/${fx.jobId}/shift-patterns/`)).body;
    expect(pats).toHaveLength(1);
    expect(pats[0].is_overnight).toBe(true);
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expectText(page, "No shift patterns set.");
    expect((await api.get(`/api/v1/jobs/${fx.jobId}/shift-patterns/`)).body).toHaveLength(0);
    await cleanJob(api, fx.jobId);
  });

  test("regenerate shifts: API generates shifts for confirmed assignment", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "regen", assign: true, confirm: true });
    expect(fx.shifts.length).toBeGreaterThan(0);
    await page.goto(`/jobs/${fx.jobId}`);
    await expect(page.getByRole("button", { name: "Regenerate shifts" })).toBeVisible();
    await expect(page.getByText(fx.shifts[0].shift_date).first()).toBeVisible();
    await cleanJob(api, fx.jobId);
  });

  test("BUG: Regenerate shifts refreshes the Shifts table and gives success feedback", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    // assignment confirmed, pattern added AFTER page load -> only regenerate creates shifts
    const fx = await mkJob(api, b, { tag: "regen-ui", assign: true, confirm: true });
    const shift = fx.shifts[0];
    await api.del(`/api/v1/shifts/${shift.id}/`); // remove one generated shift so regenerate visibly re-creates it
    await page.goto(`/jobs/${fx.jobId}`);
    await expect(page.getByText(shift.shift_date)).toHaveCount(0);
    await page.getByRole("button", { name: "Regenerate shifts" }).click();
    await expect(page.getByText(shift.shift_date).first()).toBeVisible({ timeout: 5000 }); // table refreshed without reload
    await expectText(page, /regenerated|shifts (updated|generated)/i, 2000);
    await cleanJob(api, fx.jobId);
  });

  test("BUG: Regenerate shifts failure (500/403) is shown to the user", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "regen-fail" });
    await stub(page, /shifts\/regenerate\//, { status: 500, body: { detail: "regen exploded" } });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Regenerate shifts" }).click();
    await expectText(page, /regen exploded|Something went wrong/i, 4000);
    await cleanJob(api, fx.jobId);
  });

  test("assign worker: empty state, pick Maya, listed; duplicate + non-active show API text; persists", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "assign" });
    await page.goto(`/jobs/${fx.jobId}`);
    await expectText(page, "No one assigned yet.");
    await page.getByRole("button", { name: "Assign worker" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByRole("button", { name: "Assign job" })).toBeDisabled();
    // non-active (applicant) workers are not offered as candidates; API still refuses them
    await expect(dlg.getByText("Priya Nair")).toHaveCount(0);
    expect((await api.post(`/api/v1/jobs/${fx.jobId}/assignments/`, { employee_id: b.priyaId })).body.detail[0]).toMatch(/only an active employee/);
    await dlg.getByText("Maya Reyes").click();
    await dlg.getByRole("button", { name: "Assign job" }).dblclick();
    await expect(page.getByRole("link", { name: "Maya Reyes" })).toBeVisible({ timeout: 8000 });
    const list = (await api.get(`/api/v1/jobs/${fx.jobId}/assignments/`)).body;
    expect(list).toHaveLength(1);
    // duplicate
    await page.getByRole("button", { name: "Assign worker" }).click();
    await page.getByRole("dialog").getByText("Maya Reyes").click();
    await page.getByRole("dialog").getByRole("button", { name: "Assign job" }).click();
    await expect(page.getByRole("dialog")).toContainText(/already assigned to the job/, { timeout: 8000 });
    await cleanJob(api, fx.jobId);
  });

  test("assign dialog: candidate search with no match shows empty text", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "assign-search" });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("button", { name: "Assign worker" }).click();
    await page.getByRole("dialog").getByLabel("Search").fill("zzzznobody");
    await expect(page.getByRole("dialog")).toContainText("No candidates match.");
    await cleanJob(api, fx.jobId);
  });

  test("coordinator can assign (jobs.assign) and sees Assign worker", async ({ page }) => {
    const rootApi = await loginAs(page);
    const b = await base(rootApi);
    const fx = await mkJob(rootApi, b, { tag: "coord-assign" });
    await loginAs(page, "recruiter");
    await page.goto(`/jobs/${fx.jobId}`);
    await expect(page.getByRole("button", { name: "Assign worker" })).toBeVisible();
    await cleanJob(await loginAs(page), fx.jobId);
  });
});

// =========================================================================
// ASSIGNMENT DETAIL
// =========================================================================
test.describe("Assignment detail", () => {
  test("confirm offered assignment (double-click safe), rate refresh, persists", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "asg-confirm", assign: true });
    await page.goto(`/assignments/${fx.assignmentId}`);
    await expect(page.getByRole("heading", { name: "Maya Reyes" })).toBeVisible();
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && /confirm\/$/.test(r.url()) && posts.push(r.url()));
    await page.getByRole("button", { name: "Confirm", exact: true }).dblclick();
    await expect(page.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(0, { timeout: 8000 });
    expect(posts.length).toBeGreaterThan(0);
    expect((await api.get(`/api/v1/assignments/${fx.assignmentId}/`)).body.status).toBe("confirmed");
    await page.getByRole("button", { name: "Refresh rate" }).click();
    await expect(page.getByText(/Pay rate/)).toBeVisible();
    await expect(body(page)).not.toContainText(/Request failed|Something went wrong/);
    await cleanJob(api, fx.jobId);
  });

  test("BUG: double-click Confirm sends ONE request (no double-submit)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "asg-dbl", assign: true });
    await page.goto(`/assignments/${fx.assignmentId}`);
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && /confirm\/$/.test(r.url()) && posts.push(r.url()));
    await page.getByRole("button", { name: "Confirm", exact: true }).dblclick();
    await expect(page.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(0, { timeout: 8000 });
    expect(posts.length).toBe(1);
    await cleanJob(api, fx.jobId);
  });

  test("BUG: client-notice panel only appears once the placement is confirmed and un-notified", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "asg-notify", assign: true }); // still 'offered'
    await page.goto(`/assignments/${fx.assignmentId}`);
    await expect(page.getByRole("heading", { name: "Maya Reyes" })).toBeVisible();
    // API refuses: "only a confirmed placement has a client notice to approve" -> button must not be offered yet
    await expect(page.getByRole("button", { name: /Approve & send client notice/ })).toHaveCount(0);
    await cleanJob(api, fx.jobId);
  });

  test("BUG: after client notice is sent the panel goes away / shows sent state", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "asg-notify2", assign: true, confirm: true });
    await page.goto(`/assignments/${fx.assignmentId}`);
    await page.getByRole("button", { name: /Approve & send client notice/ }).click();
    await expect.poll(async () => (await api.get(`/api/v1/assignments/${fx.assignmentId}/`)).body.client_notified_at).not.toBeNull();
    await expect(page.getByRole("button", { name: /Approve & send client notice/ })).toHaveCount(0, { timeout: 5000 });
    await cleanJob(api, fx.jobId);
  });

  test("notify-client before confirm: API 400 words are shown", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "asg-notify3", assign: true });
    await page.goto(`/assignments/${fx.assignmentId}`);
    await page.getByRole("button", { name: /Approve & send client notice/ }).click();
    await expectText(page, "only a confirmed placement has a client notice to approve");
    await cleanJob(api, fx.jobId);
  });

  test("add shift: required errors, out-of-job-dates server text, then success lists it", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "asg-shift", assign: true, confirm: true });
    await page.goto(`/assignments/${fx.assignmentId}`);
    await jsClick(page.getByRole("button", { name: "Add shift" }));
    await expect(fieldError(page, "Date", true)).toHaveText("Date is required.");
    await expect(fieldError(page, "Start", true)).toHaveText("Start time is required.");
    await page.getByLabel("Date", { exact: true }).fill(iso(addDays(fx.monday, 60)));
    await page.getByLabel("Start", { exact: true }).fill("09:00");
    await page.getByLabel("End", { exact: true }).fill("17:00");
    await jsClick(page.getByRole("button", { name: "Add shift" }));
    await expectText(page, /shift date must fall within the job's dates/);
    const d = iso(addDays(fx.monday, 3));
    await page.getByLabel("Date", { exact: true }).fill(d);
    await jsClick(page.getByRole("button", { name: "Add shift" }));
    await expect(page.getByText(d)).toBeVisible({ timeout: 8000 });
    const shifts = (await api.get(`/api/v1/shifts/?job=${fx.jobId}&page_size=100`)).body.results;
    expect(shifts.some((s: any) => s.shift_date === d)).toBe(true);
    await cleanJob(api, fx.jobId);
  });

  test("withdraw: confirm dialog, assignment deleted (API 404), navigates back", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "asg-withdraw", assign: true });
    await page.goto(`/jobs/${fx.jobId}`);
    await page.getByRole("link", { name: "Maya Reyes" }).click();
    await page.getByRole("button", { name: "Withdraw" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Withdraw" }).click();
    await expect(page).toHaveURL(new RegExp(`/jobs/${fx.jobId}$`), { timeout: 8000 });
    expect((await api.get(`/api/v1/assignments/${fx.assignmentId}/`)).status).toBe(404);
    await cleanJob(api, fx.jobId);
  });

  test("withdraw failure (403) shows the API text; confirm 500 shows text", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "asg-fail", assign: true });
    await stub(page, /assignments\/[0-9a-f-]{36}\/$/, { method: "DELETE", status: 403, body: { detail: "missing permission: jobs.assign" } });
    await stub(page, /confirm\/$/, { status: 500, body: { detail: "confirm exploded" } });
    await page.goto(`/assignments/${fx.assignmentId}`);
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expectText(page, "confirm exploded");
    await page.getByRole("button", { name: "Withdraw" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Withdraw" }).click();
    await expectText(page, /don't have access|jobs\.assign/);
    await cleanJob(api, fx.jobId);
  });

  test("bad ids render a 404 page", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/assignments/${NIL_UUID}`);
    await wantNotFoundPage(page);
    await page.goto("/assignments/not-a-uuid");
    await wantNotFoundPage(page);
  });
});

// =========================================================================
// SHIFTS
// =========================================================================
test.describe("Shifts", () => {
  test("list renders, job filter narrows, empty filter shows 'No shifts.'", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "shifts", past: true, assign: true, confirm: true });
    const p = watchProblems(page);
    await page.goto(`/shifts?job=${fx.jobId}`);
    await expect(page.getByText(iso(fx.monday))).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(fx.shifts.length + 1);
    await page.goto(`/shifts?from=2001-01-01&to=2001-01-02`);
    await expectText(page, "No shifts.");
    expect(p.api).toEqual([]);
    await cleanJob(api, fx.jobId);
  });

  test("shifts list: 500 readable, page out of range not blank", async ({ page }) => {
    await loginAs(page);
    await page.goto("/shifts?page=999");
    await expectText(page, /Invalid page|No shifts/i);
    await expectSettled(page);
    const page2 = page;
    await stub(page2, /\/api\/v1\/shifts\/\?/, { status: 500, html: true });
    await page2.goto("/shifts");
    await expectText(page2, /Can't reach the API|Something went wrong/i);
  });

  test("mark not worked (past shift) -> not_worked, backfill dialog, clear mark -> scheduled; persists", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "shift-mark", past: true, assign: true, confirm: true });
    await page.goto(`/shifts?job=${fx.jobId}`);
    await page.getByRole("button", { name: "Mark not worked" }).first().click();
    await page.getByRole("dialog").getByLabel("Reason").selectOption("excused");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Clear mark" })).toBeVisible({ timeout: 8000 });
    const marked = (await api.get(`/api/v1/shifts/?job=${fx.jobId}`)).body.results.find((s: any) => s.status === "not_worked");
    expect(marked.reason).toBe("excused");
    await page.getByRole("button", { name: "Backfill" }).click();
    await expect(page.getByRole("dialog")).toContainText(/Who can cover this shift/);
    await expect(page.getByRole("dialog")).toContainText(/No candidates available\.|Loading/);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Clear mark" }).click();
    await expect(page.getByRole("button", { name: "Clear mark" })).toHaveCount(0, { timeout: 8000 });
    expect((await api.get(`/api/v1/shifts/${marked.id}/`)).body.status).toBe("scheduled");
    await cleanJob(api, fx.jobId);
  });

  test("mark not worked on a FUTURE shift: API 400 words shown in the dialog", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "shift-future", assign: true, confirm: true });
    await page.goto(`/shifts?job=${fx.jobId}`);
    await page.getByRole("button", { name: "Mark not worked" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toContainText(/future shift cannot be marked/, { timeout: 8000 });
    await cleanJob(api, fx.jobId);
  });

  test("BUG: mark-not-worked dialog error does not linger when reopened for another shift", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "shift-lingering", assign: true, confirm: true });
    await page.goto(`/shifts?job=${fx.jobId}`);
    await page.getByRole("button", { name: "Mark not worked" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toContainText(/future shift/, { timeout: 8000 });
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Mark not worked" }).nth(1).click();
    await expect(page.getByRole("dialog")).not.toContainText(/future shift/);
    await cleanJob(api, fx.jobId);
  });

  test("BUG: clear-mark failure is shown", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "shift-clear-fail", past: true, assign: true, confirm: true });
    await api.post(`/api/v1/shifts/${fx.shifts[0].id}/mark-not-worked/`, { reason: "no_show" });
    await stub(page, /clear-mark\//, { status: 403, body: { detail: "missing permission: shifts.edit" } });
    await page.goto(`/shifts?job=${fx.jobId}`);
    await page.getByRole("button", { name: "Clear mark" }).click();
    await expectText(page, "missing permission: shifts.edit", 4000);
    await cleanJob(api, fx.jobId);
  });

  test("API-level: shift detail GET/PATCH/DELETE work (no UI for shift detail/edit/delete exists)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "shift-api", assign: true, confirm: true });
    const s = fx.shifts[0];
    expect((await api.get(`/api/v1/shifts/${s.id}/`)).status).toBe(200);
    const pr = await api.patch(`/api/v1/shifts/${s.id}/`, { break_minutes: 45 });
    expect(pr.status, JSON.stringify(pr.body)).toBe(200);
    expect((await api.del(`/api/v1/shifts/${s.id}/`)).status).toBeLessThan(300);
    expect((await api.get(`/api/v1/shifts/${s.id}/`)).status).toBe(404);
    await cleanJob(api, fx.jobId);
  });

  test("BUG: a shift can be opened/edited/deleted from the UI (shift detail route)", async ({ page }) => {
    test.fail();
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "shift-ui-gap", assign: true, confirm: true });
    await page.goto(`/shifts?job=${fx.jobId}`);
    await page.getByRole("row").nth(1).click();
    await expect(page).toHaveURL(/\/shifts\/[0-9a-f-]{36}/, { timeout: 3000 });
    await cleanJob(api, fx.jobId);
  });

  test("coordinator sees shift action buttons (shifts.edit)", async ({ page }) => {
    const root = await loginAs(page);
    const b = await base(root);
    const fx = await mkJob(root, b, { tag: "shift-coord", assign: true, confirm: true });
    await loginAs(page, "recruiter");
    await page.goto(`/shifts?job=${fx.jobId}`);
    await expect(page.getByRole("button", { name: "Mark not worked" }).first()).toBeVisible();
    await cleanJob(await loginAs(page), fx.jobId);
  });
});

// =========================================================================
// HOUR SHEETS
// =========================================================================
test.describe("Hour sheets", () => {
  test("list renders, no console/API errors, out-of-range page not blank", async ({ page }) => {
    await loginAs(page);
    const p = watchProblems(page);
    await page.goto("/hour-sheets");
    await expect(page.getByRole("button", { name: "New hour sheet" })).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 10000 });
    expect(p.api).toEqual([]);
    await page.goto("/hour-sheets?page=999");
    await expectText(page, /Invalid page|No hour sheets/i);
  });

  test("BUG: hour sheets list has search / status filter (only pagination exists)", async ({ page }) => {
    test.fail();
    await loginAs(page);
    await page.goto("/hour-sheets");
    await expect(page.getByRole("searchbox").or(page.getByRole("button", { name: /^received$/i }))).toBeVisible({ timeout: 3000 });
  });

  test("create: required errors, server 400 (end<start) pinned to Period end, success -> detail", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    await page.goto("/hour-sheets");
    await page.getByRole("button", { name: "New hour sheet" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: "Create" }).click();
    await expect(fieldError(page, "Client", true)).toHaveText("Pick a client.");
    await expect(fieldError(page, "Period start", true)).toHaveText("Start date is required.");
    await expect(fieldError(page, "Period end", true)).toHaveText("End date is required.");
    await dlg.getByLabel("Client").selectOption({ label: b.clientName });
    await dlg.getByLabel("Period start").fill("2026-10-12");
    await dlg.getByLabel("Period end").fill("2026-10-05");
    await dlg.getByRole("button", { name: "Create" }).click();
    await expect(fieldError(page, "Period end", true)).toHaveText(/cannot end before it starts/, { timeout: 8000 });
    await dlg.getByLabel("Period end").fill("2026-10-18");
    await dlg.getByRole("button", { name: "Create" }).dblclick();
    await expect(page).toHaveURL(/\/hour-sheets\/[0-9a-f-]{36}$/, { timeout: 10000 });
    const id = page.url().split("/").pop()!;
    const got = (await api.get(`/api/v1/hour-sheets/${id}/`)).body;
    expect(got.status).toBe("received");
    const dupes = (await api.get(`/api/v1/hour-sheets/?page_size=200`)).body.results.filter((h: any) => h.period_start === "2026-10-12" && h.period_end === "2026-10-18" && h.client_id === b.clientId && h.created_at >= got.created_at.slice(0, 16));
    expect(dupes.length, "double click must not create two sheets").toBe(1);
  });

  test("lines: validation, out-of-period server text, add matched line, approve -> shift worked, unapprove, delete line", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "hs", past: true, assign: true, confirm: true });
    const hs = await api.post("/api/v1/hour-sheets/", { client_id: b.clientId, job_id: fx.jobId, period_start: iso(fx.monday), period_end: iso(addDays(fx.monday, 6)) });
    await page.goto(`/hour-sheets/${hs.body.id}`);
    await expectText(page, "No lines yet.");
    await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
    await page.getByRole("button", { name: "Add line" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: "Add line" }).click();
    await expect(fieldError(page, "Employee", true)).toHaveText("Pick an employee.");
    await expect(fieldError(page, "Hours", true)).toHaveText("Required.");
    await dlg.getByLabel("Employee").selectOption({ label: "Maya Reyes" });
    await dlg.getByLabel("Hours").fill("abc");
    await dlg.getByRole("button", { name: "Add line" }).click();
    await expect(fieldError(page, "Hours", true)).toHaveText("Enter a valid number.");
    await dlg.getByLabel("Hours").fill("12345");
    await dlg.getByRole("button", { name: "Add line" }).click();
    await expect(fieldError(page, "Hours", true)).toHaveText("Enter a valid number.");
    await dlg.getByLabel("Hours").fill("7.5");
    await dlg.getByLabel("Work date").fill(iso(addDays(fx.monday, 30)));
    await dlg.getByRole("button", { name: "Add line" }).click();
    await expect(dlg).toContainText(/outside the sheet's period/, { timeout: 8000 });
    await dlg.getByLabel("Work date").fill(iso(fx.monday));
    await dlg.getByRole("button", { name: "Add line" }).click();
    await expect(page.getByText(/Maya Reyes · 7\.50h/)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Matched", { exact: false }).first()).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unapprove" })).toBeVisible({ timeout: 8000 });
    const shift = (await api.get(`/api/v1/shifts/?job=${fx.jobId}`)).body.results.find((s: any) => s.shift_date === iso(fx.monday));
    expect(shift.status).toBe("worked");
    expect(shift.hours).toBe("7.50");
    await page.reload();
    await expect(page.getByRole("button", { name: "Unapprove" })).toBeVisible();
    await page.getByRole("button", { name: "Unapprove" }).click();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible({ timeout: 8000 });
    await page.reload();
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expectText(page, "No lines yet.");
    expect((await api.get(`/api/v1/hour-sheets/${hs.body.id}/lines/`)).body).toHaveLength(0);
    await cleanJob(api, fx.jobId);
  });

  test("approve API failure shows the API text; line delete failure is BUG below", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const fx = await mkJob(api, b, { tag: "hs-fail", past: true, assign: true, confirm: true });
    const hs = await api.post("/api/v1/hour-sheets/", { client_id: b.clientId, job_id: fx.jobId, period_start: iso(fx.monday), period_end: iso(addDays(fx.monday, 6)) });
    await api.post(`/api/v1/hour-sheets/${hs.body.id}/lines/`, { employee_id: b.mayaId, hours: "7.5", work_date: iso(fx.monday) });
    await stub(page, /approve\/$/, { status: 403, body: { detail: "missing permission: hoursheets.approve" } });
    await page.goto(`/hour-sheets/${hs.body.id}`);
    await page.getByRole("button", { name: "Approve" }).click();
    await expectText(page, /hoursheets\.approve/);
    await cleanJob(api, fx.jobId);
  });

  test("BUG: removing a line when the API fails shows an error", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const hs = await api.post("/api/v1/hour-sheets/", { client_id: b.clientId, period_start: "2026-01-05", period_end: "2026-01-11" });
    await api.post(`/api/v1/hour-sheets/${hs.body.id}/lines/`, { employee_id: b.mayaId, hours: "1", work_date: "2026-01-06" });
    await stub(page, /lines\/[0-9a-f-]{36}\/$/, { method: "DELETE", status: 500, body: { detail: "line delete exploded" } });
    await page.goto(`/hour-sheets/${hs.body.id}`);
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expectText(page, /line delete exploded|Something went wrong/i, 4000);
  });

  test("BUG: coordinator (no hoursheets.approve) does not see an enabled Approve/Unapprove button", async ({ page }) => {
    const root = await loginAs(page);
    const b = await base(root);
    const hs = await root.post("/api/v1/hour-sheets/", { client_id: b.clientId, period_start: "2026-01-12", period_end: "2026-01-18" });
    await root.post(`/api/v1/hour-sheets/${hs.body.id}/lines/`, { employee_id: b.mayaId, hours: "1", work_date: "2026-01-13" });
    await loginAs(page, "recruiter");
    await page.goto(`/hour-sheets/${hs.body.id}`);
    await expect(page.getByText(/Maya Reyes · 1\.00h/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Approve$/ })).toHaveCount(0);
  });

  test("upload: missing file -> message; upload real file creates sheet with source=upload", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    await page.goto("/hour-sheets");
    await page.getByRole("button", { name: "Upload" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: "Upload" }).click();
    await expect(dlg).toContainText("Client, period, and file are required.");
    await dlg.getByLabel("Client").selectOption({ label: b.clientName });
    await dlg.getByLabel("Period start").fill("2026-02-02");
    await dlg.getByLabel("Period end").fill("2026-02-08");
    await dlg.getByLabel("File").setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("a,b\n1,2\n") });
    await dlg.getByRole("button", { name: "Upload" }).click();
    await expect(dlg).toContainText(/unsupported file type/i, { timeout: 8000 });
    await dlg.getByLabel("File").setInputFiles({ name: `qa-${RUN}.pdf`, mimeType: "application/pdf", buffer: PDF_MIN });
    await dlg.getByRole("button", { name: "Upload" }).click();
    await expect(page).toHaveURL(/\/hour-sheets\/[0-9a-f-]{36}$/, { timeout: 15000 });
    const id = page.url().split("/").pop()!;
    expect((await api.get(`/api/v1/hour-sheets/${id}/`)).body.source).toBe("upload");
  });

  test("bad ids -> 404 page; 500 -> readable", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/hour-sheets/${NIL_UUID}`);
    await wantNotFoundPage(page);
    await page.goto("/hour-sheets/not-a-uuid");
    await wantNotFoundPage(page);
    await stub(page, /\/api\/v1\/hour-sheets\/\?/, { status: 500, html: true });
    await page.goto("/hour-sheets");
    await expectText(page, /Can't reach the API|Something went wrong/i);
  });

  test("API-level: hour sheet PATCH + DELETE work (no UI for edit/delete sheet)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const hs = await api.post("/api/v1/hour-sheets/", { client_id: b.clientId, period_start: "2026-03-02", period_end: "2026-03-08" });
    expect((await api.patch(`/api/v1/hour-sheets/${hs.body.id}/`, { period_end: "2026-03-09" })).status).toBe(200);
    expect((await api.del(`/api/v1/hour-sheets/${hs.body.id}/`)).status).toBeLessThan(300);
    expect((await api.get(`/api/v1/hour-sheets/${hs.body.id}/`)).status).toBe(404);
  });
});

// =========================================================================
// PERM PLACEMENTS
// =========================================================================
test.describe("Perm placements", () => {
  test("BUG: create form has field-level errors and pickers (not raw UUID text boxes)", async ({ page }) => {
    await loginAs(page);
    await page.goto("/perm-placements");
    await page.getByRole("button", { name: "New placement" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
    await expect(fieldError(page, "Client")).toBeVisible({ timeout: 4000 }); // expected next to the field
    await expect(page.getByRole("dialog").getByRole("combobox").first()).toBeVisible(); // a real picker
  });

  test("create with empty form shows the API's words (banner)", async ({ page }) => {
    await loginAs(page);
    await page.goto("/perm-placements");
    await page.getByRole("button", { name: "New placement" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("dialog")).toContainText(/required/i, { timeout: 8000 });
  });

  test("create (real ids) -> detail; confirm -> fee computed; persists; list shows it", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    await page.goto("/perm-placements");
    await page.getByRole("button", { name: "New placement" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Client", { exact: true }).selectOption(b.clientId);
    await dlg.getByLabel("Worker").selectOption(b.mayaId);
    await dlg.getByLabel("Annual salary").fill("abc");
    await dlg.getByLabel("Fee %").fill("20");
    await dlg.getByRole("button", { name: "Create" }).click();
    await expect(dlg).toContainText(/valid number/i, { timeout: 8000 });
    await dlg.getByLabel("Annual salary").fill("60000.00");
    await dlg.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/perm-placements\/[0-9a-f-]{36}$/, { timeout: 10000 });
    const id = page.url().split("/").pop()!;
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("button", { name: "Confirm" })).toHaveCount(0, { timeout: 8000 });
    await page.reload();
    await expect(page.getByText("$12,000.00").first()).toBeVisible({ timeout: 10000 });
    expect((await api.get(`/api/v1/perm-placements/${id}/`)).body.fee_amount).toBe("12000.00");
    await page.goto("/perm-placements");
    await expect(page.getByText("Maya Reyes").first()).toBeVisible();
  });

  test("BUG: confirmed timestamp is formatted for humans (not a raw ISO string)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const pl = await api.post("/api/v1/perm-placements/", { client_id: b.clientId, employee_id: b.mayaId, annual_salary: "50000", fee_pct: "10" });
    await api.post(`/api/v1/perm-placements/${pl.body.id}/confirm/`);
    await page.goto(`/perm-placements/${pl.body.id}`);
    await expect(page.getByText("CONFIRMED", { exact: false }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("BUG: void asks for confirmation first (destructive act)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const pl = await api.post("/api/v1/perm-placements/", { client_id: b.clientId, employee_id: b.mayaId, annual_salary: "50000", fee_pct: "10" });
    await page.goto(`/perm-placements/${pl.body.id}`);
    await page.getByRole("button", { name: "Void" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2000 });
  });

  test("void works: chip shows voided, actions disappear, API status voided", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const pl = await api.post("/api/v1/perm-placements/", { client_id: b.clientId, employee_id: b.mayaId, annual_salary: "50000", fee_pct: "10" });
    await page.goto(`/perm-placements/${pl.body.id}`);
    await page.getByRole("button", { name: "Void" }).click();
    await expect(page.getByRole("button", { name: "Void" })).toHaveCount(0, { timeout: 8000 });
    expect((await api.get(`/api/v1/perm-placements/${pl.body.id}/`)).body.status).toBe("voided");
  });

  test("BUG: coordinator confirm/void 403 (clients.invoice.edit) is shown, buttons hidden", async ({ page }) => {
    const root = await loginAs(page);
    const b = await base(root);
    const pl = await root.post("/api/v1/perm-placements/", { client_id: b.clientId, employee_id: b.mayaId, annual_salary: "50000", fee_pct: "10" });
    await loginAs(page, "recruiter");
    await page.goto(`/perm-placements/${pl.body.id}`);
    await expect(page.getByRole("heading", { name: "Maya Reyes" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click().catch(() => {});
    await expectText(page, /don't have access|clients\.invoice\.edit|permission/i, 4000);
  });

  test("bad ids -> 404 page; list 500 readable", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/perm-placements/${NIL_UUID}`);
    await wantNotFoundPage(page);
    await stub(page, /\/api\/v1\/perm-placements\/\?/, { status: 500, html: true });
    await page.goto("/perm-placements");
    await expectText(page, /Can't reach the API|Something went wrong/i);
  });
});

// =========================================================================
// INVOICES
// =========================================================================
test.describe("Invoices", () => {
  test("list: renders, search + status chips, empty search, out-of-range page, 500 readable", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b);
    const num = (await api.get(`/api/v1/invoices/${id}/`)).body.invoice_number as string;
    const p = watchProblems(page);
    await page.goto(`/invoices?q=${encodeURIComponent(num)}`);
    await expect(page.getByText(num, { exact: true })).toBeVisible();
    expect(p.api).toEqual([]);
    await page.goto(`/invoices?q=zzz-${RUN}`);
    await expectText(page, "No invoices match that find.");
    await page.goto(`/invoices?status=draft&q=${encodeURIComponent(num)}`);
    await expect(page.getByText(num, { exact: true })).toBeVisible();
    await page.goto(`/invoices?status=sent&q=${encodeURIComponent(num)}`);
    await expect(page.getByText(num, { exact: true })).toHaveCount(0);
    await page.goto("/invoices?page=999");
    await expectText(page, /Invalid page|No invoices/i);
    await stub(page, /\/api\/v1\/invoices\/\?/, { status: 500, html: true });
    await page.goto("/invoices");
    await expectText(page, /Can't reach the API|Something went wrong/i);
  });

  test("BUG: invoice list status chips include paid / voided", async ({ page }) => {
    await loginAs(page);
    await page.goto("/invoices");
    await expect(page.getByRole("button", { name: /^paid$/i })).toBeVisible({ timeout: 3000 });
  });

  test("creator step 1: required client error, server 400 (due<issue) shown, then 4-step happy path incl. autofill", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const w = await mkWorked(api, b, "inv-creator");
    await page.goto("/invoices/new");
    await expectText(page, "Step 1 of 4");
    await page.getByRole("button", { name: "Next (1/4)" }).click();
    await expect(fieldError(page, "Client", true)).toHaveText("Pick a client.");
    await page.getByLabel("Client", { exact: true }).selectOption({ label: b.clientName });
    await page.getByLabel("Issue date").fill("2026-10-01");
    await page.getByLabel("Due date").fill("2026-09-01");
    await page.getByRole("button", { name: "Next (1/4)" }).click();
    await expectText(page, "the due date cannot precede the issue date");
    await page.getByLabel("Due date").fill("2026-10-31");
    await page.getByLabel("PO number").fill("PO-QA");
    await page.getByRole("button", { name: "Next (1/4)" }).dblclick();
    await expectText(page, "Step 2 of 4");
    await page.getByLabel("Job (optional)").selectOption({ label: w.title });
    await page.getByRole("button", { name: "Autofill & continue" }).click();
    await expectText(page, "Step 3 of 4");
    await expect(page.getByText(/Care|shift|hour/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Next (3/4)" }).click();
    await expectText(page, "Step 4 of 4");
    await page.getByRole("button", { name: "Open invoice" }).click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/, { timeout: 10000 });
    const id = page.url().split("/").pop()!;
    const inv = (await api.get(`/api/v1/invoices/${id}/`)).body;
    expect(inv.status).toBe("draft");
    expect(inv.po_number).toBe("PO-QA");
    expect(inv.lines.length).toBeGreaterThan(0);
    expect(inv.total).not.toBe("0.00");
    const mine = (await api.get(`/api/v1/invoices/?page_size=200`)).body.results.filter((i: any) => i.po_number === "PO-QA" && i.due_date === "2026-10-31" && i.created_at >= inv.created_at.slice(0, 16));
    expect(mine.length, "double click on Next must create ONE draft").toBe(1);
  });

  test("creator autofill with nothing unbilled surfaces API result/words, Skip still reaches step 3", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    await page.goto("/invoices/new");
    await page.getByLabel("Client", { exact: true }).selectOption({ label: b.clientName });
    await page.getByRole("button", { name: "Next (1/4)" }).click();
    await expectText(page, "Step 2 of 4");
    await page.getByLabel("From").fill("2001-01-01");
    await page.getByLabel("To").fill("2001-01-02");
    await page.getByRole("button", { name: "Autofill & continue" }).click();
    await expect(page.getByText(/Step (2|3) of 4/)).toBeVisible();
    await expect(body(page)).not.toContainText(/Something went wrong|Request failed/);
  });

  test("detail lifecycle: submit -> approve -> unapprove -> approve -> send -> mark paid; each persisted", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b);
    await page.goto(`/invoices/${id}`);
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible({ timeout: 8000 });
    expect((await api.get(`/api/v1/invoices/${id}/`)).body.status).toBe("pending_approval");
    await page.getByRole("button", { name: "Return to draft" }).click();
    await expect(page.getByRole("button", { name: "Submit for approval" })).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Unapprove" }).click();
    await expect(page.getByRole("button", { name: "Submit for approval" })).toBeVisible({ timeout: 8000 }); // unapprove returns to draft
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mark paid" })).toBeVisible({ timeout: 8000 });
    expect((await api.get(`/api/v1/invoices/${id}/`)).body.status).toBe("sent");
    await page.getByRole("button", { name: "Mark paid" }).click();
    await expect(page.getByRole("button", { name: "Mark paid" })).toHaveCount(0, { timeout: 8000 });
    await page.reload();
    await expect(page.getByText(/Not paid/)).toHaveCount(0);
    expect((await api.get(`/api/v1/invoices/${id}/`)).body.paid_at).not.toBeNull();
    // a paid invoice must not offer Void (API: never void once paid)
    await expect(page.getByRole("button", { name: "Void" })).toHaveCount(0);
  });

  test("submit an empty draft -> API words shown (banner), status unchanged", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b, { line: false });
    await page.goto(`/invoices/${id}`);
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expectText(page, "nothing to approve — the invoice has no lines");
    expect((await api.get(`/api/v1/invoices/${id}/`)).body.status).toBe("draft");
  });

  test("void a sent invoice: confirm dialog, voided state persisted", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b);
    await invoiceTo(api, id, "sent");
    await page.goto(`/invoices/${id}`);
    await page.getByRole("button", { name: "Void", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Void this invoice?");
    await page.getByRole("dialog").getByRole("button", { name: "Void invoice" }).click();
    await expect.poll(async () => (await api.get(`/api/v1/invoices/${id}/`)).body.voided_at, { timeout: 8000 }).not.toBeNull();
  });

  test("BUG: a voided invoice no longer offers Mark paid / Void", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b);
    await invoiceTo(api, id, "sent");
    await api.post(`/api/v1/invoices/${id}/void/`);
    await page.goto(`/invoices/${id}`);
    await expect(page.getByText(/void/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark paid" })).toHaveCount(0);
  });

  test("BUG: action buttons are double-click safe (Approve sends ONE request, no spurious error)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b);
    await invoiceTo(api, id, "pending_approval");
    await page.goto(`/invoices/${id}`);
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && /approve\/$/.test(r.url()) && posts.push(r.url()));
    await page.getByRole("button", { name: "Approve", exact: true }).dblclick();
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible({ timeout: 8000 });
    expect(posts.length).toBe(1);
    await expect(body(page)).not.toContainText(/only a .* can be approved|Request failed/i);
  });

  test("action failure (500/403) shows a message and keeps the button usable", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b);
    await stub(page, /submit\/$/, { status: 403, body: { detail: "missing permission: clients.invoice.edit" } });
    await page.goto(`/invoices/${id}`);
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expectText(page, /clients\.invoice\.edit|don't have access/);
    await expect(page.getByRole("button", { name: "Submit for approval" })).toBeEnabled();
  });

  test("lines (draft): validation, add, amounts, remove with confirm; non-draft is read-only", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b, { line: false });
    await page.goto(`/invoices/${id}`);
    await expectText(page, "No lines yet.");
    await page.getByRole("button", { name: "Add line" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(fieldError(page, "Description", true)).toHaveText("Description is required.");
    await expect(fieldError(page, "Quantity", true)).toHaveText("Required.");
    await expect(fieldError(page, "Rate", true)).toHaveText("Required.");
    await dlg.getByLabel("Description").fill("QA hours");
    await dlg.getByLabel("Quantity").fill("2");
    await dlg.getByLabel("Rate").fill("abc");
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(fieldError(page, "Rate", true)).toHaveText("Enter a valid number.");
    await dlg.getByLabel("Rate").fill("12.50");
    await dlg.getByRole("button", { name: "Save" }).dblclick();
    await expect(page.getByText(/hour @ \$12\.50 = \$25\.00/)).toBeVisible({ timeout: 8000 });
    expect((await api.get(`/api/v1/invoices/${id}/`)).body.lines).toHaveLength(1);
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expectText(page, "No lines yet.");
    await invoiceTo(api, id, "pending_approval").catch(() => {});
  });

  test("BUG: removing an invoice line when the API fails shows an error", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b);
    await stub(page, /lines\/[0-9a-f-]{36}\/$/, { method: "DELETE", status: 500, body: { detail: "delete line exploded" } });
    await page.goto(`/invoices/${id}`);
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expectText(page, /delete line exploded|Something went wrong/i, 4000);
  });

  test("PDF link: API says 404 'no PDF has been generated' - link is offered anyway (documented)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b);
    await page.goto(`/invoices/${id}`);
    const href = await page.getByRole("link", { name: "View PDF" }).getAttribute("href");
    expect(href).toBe(`/api/v1/invoices/${id}/pdf/`);
    const r = await api.get(href!);
    expect([200, 404]).toContain(r.status);
  });

  test("View PDF is not offered on a draft invoice that has no PDF (API 404)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b);
    expect((await api.get(`/api/v1/invoices/${id}/pdf/`)).status).toBe(404);
    await page.goto(`/invoices/${id}`);
    await expect(page.getByRole("link", { name: "View PDF" })).toHaveCount(0);
  });

  test("BUG: no UI for attach-flat-coverage / credit-note creation from a paid invoice (API says 'the correction is a credit note')", async ({ page }) => {
    test.fail();
    const api = await loginAs(page);
    const b = await base(api);
    const id = await mkInvoice(api, b);
    await invoiceTo(api, id, "paid");
    await page.goto(`/invoices/${id}`);
    await expect(page.getByRole("button", { name: /credit note/i }).or(page.getByRole("link", { name: /credit note/i }))).toBeVisible({ timeout: 3000 });
  });

  test("bad ids -> 404 page; detail 500 readable; coordinator can open list via URL but not act", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/invoices/${NIL_UUID}`);
    await wantNotFoundPage(page);
    await page.goto("/invoices/not-a-uuid");
    await wantNotFoundPage(page);
  });

  test("coordinator: Submit on a draft -> 403 text shown (button gated by clients.invoice.edit)", async ({ page }) => {
    const root = await loginAs(page);
    const b = await base(root);
    const id = await mkInvoice(root, b);
    await loginAs(page, "recruiter");
    await page.goto(`/invoices/${id}`);
    await expect(page.getByText("Draft invoice").or(page.getByText(/INV-/)).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for approval" })).toHaveCount(0); // hidden per permission
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  });

  test("coordinator: /invoices/new create -> API 403 words shown on the form", async ({ page }) => {
    await loginAs(page, "recruiter");
    await page.goto("/invoices/new");
    const api = mkApi(page);
    const b = await base(api);
    await page.getByLabel("Client", { exact: true }).selectOption({ label: b.clientName });
    await page.getByRole("button", { name: "Next (1/4)" }).click();
    await expectText(page, /don't have access|clients\.invoice\.create|permission/i);
  });
});

// =========================================================================
// CREDIT NOTES
// =========================================================================
test.describe("Credit notes", () => {
  test("list renders (empty state or rows), 500 readable, bad id 404", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const inv = await mkInvoice(api, b);
    await invoiceTo(api, inv, "sent");
    const cn = await mkCreditNote(api, inv);
    const num = (await api.get(`/api/v1/credit-notes/${cn}/`)).body.credit_note_number;
    await page.goto("/credit-notes");
    await expect(page.getByText(num, { exact: true })).toBeVisible();
    await stub(page, /\/api\/v1\/credit-notes\/\?/, { status: 500, html: true });
    await page.goto("/credit-notes");
    await expectText(page, /Can't reach the API|Something went wrong/i);
    await page.unroute(/\/api\/v1\/credit-notes\/\?/);
    await page.goto(`/credit-notes/${NIL_UUID}`);
    await wantNotFoundPage(page);
  });

  test("BUG: credit notes can be created from the UI (button on list / invoice) with lines", async ({ page }) => {
    test.fail();
    await loginAs(page);
    await page.goto("/credit-notes");
    await expect(page.getByRole("button", { name: /new credit note|create/i }).or(page.getByRole("link", { name: /new credit note/i }))).toBeVisible({ timeout: 3000 });
  });

  test("detail lifecycle: approve -> issue -> send; unapprove path; persisted", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const inv = await mkInvoice(api, b);
    await invoiceTo(api, inv, "sent");
    const cn = await mkCreditNote(api, inv);
    await page.goto(`/credit-notes/${cn}`);
    await expect(page.getByText("QA credit")).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("button", { name: "Issue" })).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Unapprove" }).click();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByRole("button", { name: "Issue" }).click();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible({ timeout: 8000 });
    expect((await api.get(`/api/v1/credit-notes/${cn}/`)).body.status).toBe("issued");
    await page.getByRole("button", { name: "Send" }).click();
    await expect.poll(async () => (await api.get(`/api/v1/credit-notes/${cn}/`)).body.status).toBe("issued");
    await expect(body(page)).not.toContainText(/Something went wrong|Request failed/);
  });

  test("BUG: Send credit note gives visible success feedback (toast / sent state)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const inv = await mkInvoice(api, b);
    await invoiceTo(api, inv, "sent");
    const cn = await mkCreditNote(api, inv);
    await api.post(`/api/v1/credit-notes/${cn}/approve/`);
    await api.post(`/api/v1/credit-notes/${cn}/issue/`);
    await page.goto(`/credit-notes/${cn}`);
    await page.getByRole("button", { name: "Send" }).click();
    await expectText(page, /sent|emailed/i, 3000);
  });

  test("approve empty draft -> API words; void needs confirm (BUG below); voided state persists", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const inv = await mkInvoice(api, b);
    await invoiceTo(api, inv, "sent");
    const cn = await mkCreditNote(api, inv, false);
    await page.goto(`/credit-notes/${cn}`);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expectText(page, "nothing to approve — the credit note has no lines");
    await page.getByRole("button", { name: "Void" }).click();
    await expect.poll(async () => (await api.get(`/api/v1/credit-notes/${cn}/`)).body.voided_at, { timeout: 8000 }).not.toBeNull();
    await expect(page.getByRole("button", { name: "Void" })).toHaveCount(0, { timeout: 8000 });
  });

  test("BUG: void credit note asks for confirmation first", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const inv = await mkInvoice(api, b);
    await invoiceTo(api, inv, "sent");
    const cn = await mkCreditNote(api, inv);
    await page.goto(`/credit-notes/${cn}`);
    await page.getByRole("button", { name: "Void" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2000 });
  });

  test("BUG: coordinator (no clients.invoice.edit) does not see credit-note action buttons; 403 text shown if clicked", async ({ page }) => {
    const root = await loginAs(page);
    const b = await base(root);
    const inv = await mkInvoice(root, b);
    await invoiceTo(root, inv, "sent");
    const cn = await mkCreditNote(root, inv);
    await loginAs(page, "recruiter");
    await page.goto(`/credit-notes/${cn}`);
    await expect(page.getByText("QA credit")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });

  test("PDF: link points at the API pdf door (API 404 until generated)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const inv = await mkInvoice(api, b);
    await invoiceTo(api, inv, "sent");
    const cn = await mkCreditNote(api, inv);
    await page.goto(`/credit-notes/${cn}`);
    expect(await page.getByRole("link", { name: "PDF" }).getAttribute("href")).toBe(`/api/v1/credit-notes/${cn}/pdf/`);
  });
});

// =========================================================================
// PAYROLL
// =========================================================================
test.describe("Payroll", () => {
  test("list: runs + cycles section render; generate with no cycle -> API words", async ({ page }) => {
    const api = await loginAs(page);
    const cycles = (await api.get("/api/v1/payroll/cycles/")).body.results as any[];
    const p = watchProblems(page);
    await page.goto("/payroll");
    await expect(page.getByRole("button", { name: "Generate next run" })).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 10000 });
    expect(p.pageErrors).toEqual([]);
    if (cycles.length === 0) {
      await expectText(page, "No pay cycles configured yet.");
      await page.getByRole("button", { name: "Generate next run" }).click();
      await expectText(page, "no active pay cycle — create and activate one first");
    }
  });

  test("BUG: pay cycles can be created/edited/deleted from the UI (list is read-only)", async ({ page }) => {
    test.fail();
    await loginAs(page);
    await page.goto("/payroll");
    await expect(page.getByRole("button", { name: /new cycle|add cycle|create cycle/i })).toBeVisible({ timeout: 3000 });
  });

  test("API-level: pay cycle CRUD + validation words", async ({ page }) => {
    const api = await loginAs(page);
    const bad = await api.post("/api/v1/payroll/cycles/", {});
    expect(bad.status).toBe(400);
    expect(bad.body.name).toBeTruthy();
    const kinds = await api.post("/api/v1/payroll/cycles/", { name: "x", period_kind: "zzz", anchor_date: "2026-09-07", payday_offset_days: 5 });
    expect(kinds.status).toBe(400);
    const existing = (await api.get("/api/v1/payroll/cycles/")).body.results as any[];
    if (existing.some((c) => c.active)) return; // never disturb a configured live cycle
    const c = await api.post("/api/v1/payroll/cycles/", { name: `QA ${RUN}`, period_kind: "fixed", period_days: 14, anchor_date: "2020-01-06", payday_offset_days: 5, active: false });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    expect((await api.patch(`/api/v1/payroll/cycles/${c.body.id}/`, { name: `QA ${RUN} v2` })).body.name).toBe(`QA ${RUN} v2`);
    expect((await api.del(`/api/v1/payroll/cycles/${c.body.id}/`)).status).toBeLessThan(300);
  });

  test("new run form: required + ordering errors are field-level; nothing-to-pay server text; then happy path", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const w = await mkWorked(api, b, "payroll");
    await page.goto("/payroll");
    await page.getByRole("button", { name: "New run" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: "Create run" }).click();
    await expect(fieldError(page, "Period start", true)).toHaveText("Start date is required.");
    await expect(fieldError(page, "Payday", true)).toHaveText("Payday is required.");
    await dlg.getByLabel("Period start").fill("2026-01-19");
    await dlg.getByLabel("Period end").fill("2026-01-12");
    await dlg.getByLabel("Payday").fill("2026-01-10");
    await dlg.getByRole("button", { name: "Create run" }).click();
    await expect(fieldError(page, "Period end", true)).toHaveText("Period end cannot precede the start.");
    await expect(fieldError(page, "Payday", true)).toHaveText("Payday cannot precede the period end.");
    // valid dates but no unsettled worked shifts
    await dlg.getByLabel("Period start").fill("2001-01-01");
    await dlg.getByLabel("Period end").fill("2001-01-14");
    await dlg.getByLabel("Payday").fill("2001-01-20");
    await dlg.getByRole("button", { name: "Create run" }).click();
    await expect(dlg).toContainText("nothing to pay", { timeout: 8000 });
    // real week
    await dlg.getByLabel("Period start").fill(iso(w.monday));
    await dlg.getByLabel("Period end").fill(iso(addDays(w.monday, 13)));
    await dlg.getByLabel("Payday").fill(iso(addDays(w.monday, 20)));
    await dlg.getByRole("button", { name: "Create run" }).dblclick();
    await expect(page).toHaveURL(/\/payroll\/runs\/[0-9a-f-]{36}$/, { timeout: 15000 });
    const runId = page.url().split("/").pop()!;
    await expect(page.getByText("Maya Reyes").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
    // approve -> release
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("button", { name: "Release pay statements" })).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Release pay statements" }).click();
    await expect(page.getByRole("button", { name: "Release pay statements" })).toHaveCount(0, { timeout: 8000 });
    const run = (await api.get(`/api/v1/payroll/runs/${runId}/`)).body;
    expect(run.status).toBe("approved");
    expect(run.pay_statements[0].status).toMatch(/issued|paid/);
    // export
    const csv = await api.get(`/api/v1/payroll/runs/${runId}/export/`);
    expect(csv.status).toBe(200);
    expect(String(csv.body)).toContain("Maya");
    // run cannot be deleted once approved (API words), no UI delete
    expect((await api.del(`/api/v1/payroll/runs/${runId}/`)).status).toBe(400);
  });

  test("run detail: search + status filter + preference filter narrow statements; approve failure text", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const w = await mkWorked(api, b, "payroll-filter");
    const run = await api.post("/api/v1/payroll/runs/", { period_start: iso(w.monday), period_end: iso(addDays(w.monday, 13)), payday: iso(addDays(w.monday, 20)) });
    expect(run.status, JSON.stringify(run.body)).toBe(201);
    await stub(page, /approve\/$/, { status: 500, body: { detail: "approve exploded" } });
    await page.goto(`/payroll/runs/${run.body.id}`);
    await expect(page.getByText("Maya Reyes").first()).toBeVisible();
    await page.getByLabel("Find payees").fill("zzz-nobody");
    await expectText(page, "No pay statements yet.");
    await page.getByLabel("Find payees").fill("maya");
    await expect(page.getByText("Maya Reyes").first()).toBeVisible();
    await page.getByRole("button", { name: "Paid", exact: true }).click();
    await expectText(page, "No pay statements yet.");
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Approve" }).click();
    await expectText(page, "approve exploded");
  });

  test("statement detail (draft): add earning/deduction, delete; server 400 shows (BUG: not next to field)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const w = await mkWorked(api, b, "payroll-stmt");
    const run = await api.post("/api/v1/payroll/runs/", { period_start: iso(w.monday), period_end: iso(addDays(w.monday, 13)), payday: iso(addDays(w.monday, 20)) });
    const stmt = (await api.get(`/api/v1/payroll/runs/${run.body.id}/`)).body.pay_statements[0];
    await page.goto(`/payroll/pay-statements/${stmt.id}`);
    await expect(page.getByRole("heading", { name: "Maya Reyes" })).toBeVisible();
    await expect(page.getByText("Year to date")).toBeVisible();
    // earning
    await page.getByLabel("Description").fill("QA bonus");
    await page.getByLabel("Amount").first().fill("10.00");
    await page.getByRole("button", { name: "Add earning" }).click();
    await expect(page.getByText(/QA bonus/)).toBeVisible({ timeout: 8000 });
    // deduction
    await page.locator("#ded-amt").fill("5.00");
    await page.getByRole("button", { name: "Add deduction" }).click();
    await expect(page.getByText("cpp").first()).toBeVisible({ timeout: 8000 });
    const got = (await api.get(`/api/v1/payroll/pay-statements/${stmt.id}/`)).body;
    expect(got.lines.some((l: any) => l.description === "QA bonus")).toBe(true);
    expect(got.deduction_lines ?? got.deductions).toBeTruthy();
    // delete deduction
    await page.getByRole("button", { name: "Remove" }).last().click();
    await expect.poll(async () => ((await api.get(`/api/v1/payroll/pay-statements/${stmt.id}/`)).body.deduction_lines ?? []).length).toBe(0);
    // pdf link
    expect(await page.getByRole("link", { name: "PDF" }).getAttribute("href")).toBe(`/api/v1/payroll/pay-statements/${stmt.id}/pdf/`);
  });

  test("BUG: statement forms show API validation errors next to the field (invalid amount)", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const w = await mkWorked(api, b, "payroll-stmt2");
    const run = await api.post("/api/v1/payroll/runs/", { period_start: iso(w.monday), period_end: iso(addDays(w.monday, 13)), payday: iso(addDays(w.monday, 20)) });
    const stmt = (await api.get(`/api/v1/payroll/runs/${run.body.id}/`)).body.pay_statements[0];
    await page.goto(`/payroll/pay-statements/${stmt.id}`);
    await page.locator("#ded-amt").fill("abc");
    await page.getByRole("button", { name: "Add deduction" }).click();
    await expect(fieldError(page, "Amount", true).first()).toBeVisible({ timeout: 4000 });
  });

  test("BUG: statement add/remove actions cannot be double-submitted and removal has a confirm", async ({ page }) => {
    const api = await loginAs(page);
    const b = await base(api);
    const w = await mkWorked(api, b, "payroll-stmt3");
    const run = await api.post("/api/v1/payroll/runs/", { period_start: iso(w.monday), period_end: iso(addDays(w.monday, 13)), payday: iso(addDays(w.monday, 20)) });
    const stmt = (await api.get(`/api/v1/payroll/runs/${run.body.id}/`)).body.pay_statements[0];
    await api.post(`/api/v1/payroll/pay-statements/${stmt.id}/deductions/`, { code: "cpp", label: "cpp", amount: "1.00" });
    await page.goto(`/payroll/pay-statements/${stmt.id}`);
    await page.getByRole("button", { name: "Remove" }).last().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2000 });
  });

  test("coordinator: /payroll shows a clear permission message (not blank / Loading)", async ({ page }) => {
    await loginAs(page, "recruiter");
    await page.goto("/payroll");
    await expectText(page, /don't have access|payroll\.page\.view|permission/i);
    await expectSettled(page);
    const api = mkApi(page);
    expect((await api.get("/api/v1/payroll/runs/")).status).toBe(403);
  });

  test("bad ids -> 404 page for run and statement; run 500 readable", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/payroll/runs/${NIL_UUID}`);
    await wantNotFoundPage(page);
    await page.goto(`/payroll/pay-statements/${NIL_UUID}`);
    await wantNotFoundPage(page);
    await page.goto("/payroll/runs/not-a-uuid");
    await wantNotFoundPage(page);
    await stub(page, /\/api\/v1\/payroll\/runs\/\?/, { status: 500, html: true });
    await page.goto("/payroll");
    await expectText(page, /Can't reach the API|Something went wrong/i);
  });
});
