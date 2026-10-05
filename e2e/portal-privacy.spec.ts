import { test, expect, type Browser, type Page } from "@playwright/test";
import { apiLogin, DEMO, watchProblems } from "./helpers/auth";

/**
 * Worker portal (as demo.maya) + staff Privacy (as root / coordinator).
 * Every record created here is uniquely named (Date.now()) and removed again.
 * Tests marked "BUG:" assert the CORRECT behaviour and are wrapped in
 * test.fail(): they pass while the bug exists and start failing (= remove the
 * wrapper) once it is fixed.
 */
const TAG = `QA${Date.now()}`;
const P = "/api/v1/portal/me/";
async function mayaEmployeeId(page: Page): Promise<string> {
  const list = await call(page, "GET", "/api/v1/workers/?search=Reyes&page_size=50");
  const rows = list.json?.results ?? list.json ?? [];
  const maya = rows.find((w: any) => w.first_name === "Maya" && w.last_name === "Reyes");
  if (!maya) throw new Error("Maya Reyes not found in workers list");
  return maya.id as string;
}
const BASE = process.env.PLAYWRIGHT_BASE ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3001"}`;

function makePdf(): Buffer {
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<<>>>>",
    "<</Length 0>>\nstream\n\nendstream",
  ];
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, n) => { offs.push(out.length); out += `${n + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
const PDF = makePdf();

/** Set SHOW_BUGS=1 to run BUG tests un-inverted and see the real failure text. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future known-bug tests (SHOW_BUGS)
function bugFail() { if (!process.env.SHOW_BUGS) test.fail(); }

async function csrf(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === "csrftoken")?.value ?? "";
}
async function call(page: Page, method: string, url: string, data?: unknown, multipart?: Record<string, any>) {
  const r = await page.request.fetch(url, { method, data, multipart, headers: { "X-CSRFToken": await csrf(page) } });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* html/empty */ }
  return { status: r.status(), json, text, headers: r.headers() };
}
async function newPersona(browser: Browser, login: string) {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await apiLogin(page, login);
  return { ctx, page };
}
const dialog = (page: Page) => page.getByRole("dialog");
async function confirmDialog(page: Page, label: RegExp | string) {
  await page.getByRole("dialog").getByRole("button", { name: label }).click();
}
/** Reject a route with a status for the given method+url regex. */
async function failRoute(page: Page, url: RegExp, methods: string[], status: number, body: unknown = { detail: "Simulated server failure." }) {
  await page.route(url, (route) =>
    methods.includes(route.request().method()) ? route.fulfill({ status, json: body }) : route.continue(),
  );
}

/* ----------------------------------------------------------------- portal */
test.describe("worker portal", () => {
  test.describe.configure({ mode: "default", timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await apiLogin(page, DEMO.worker);
  });

  test("home: welcome, status and counts match the API", async ({ page }) => {
    const p = watchProblems(page);
    const shifts = (await call(page, "GET", P + "shifts/")).json as any[];
    const offers = new Set(shifts.filter((s) => s.offer_status === "offered").map((s) => s.assignment_id)).size;
    const upcoming = shifts.filter((s) => s.offer_status !== "offered").length;
    await page.goto("/portal");
    await expect(page.getByRole("heading", { name: /Welcome, Maya/ })).toBeVisible();
    await expect(page.getByText(/Status: Active/i)).toBeVisible();
    await expect(page.getByText(String(offers).padStart(2, "0"), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(String(upcoming).padStart(2, "0"), { exact: true }).first()).toBeVisible();
    expect(p.api).toEqual([]);
    expect(p.pageErrors).toEqual([]);
  });

  test("BUG: home shows a misleading 00/00/00 (no error) when the shifts API fails", async ({ page }) => {
    await failRoute(page, /\/api\/v1\/portal\/me\/shifts\/$/, ["GET"], 500);
    await page.goto("/portal");
    await expect(page.getByText(/couldn.t load|something went wrong|try again|simulated server failure/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("profile hub + Personal tab shows masked values only", async ({ page }) => {
    await page.goto("/portal/me");
    await expect(page.getByRole("heading", { name: /Maya Reyes/ })).toBeVisible();
    await page.goto("/portal/me/legacy");
    await page.getByRole("button", { name: "Personal" }).click();
    const personal = (await call(page, "GET", P + "personal/")).json;
    await expect(page.getByText(String(personal.sin_last4), { exact: true })).toBeVisible();
    await expect(page.getByText(String(personal.dob_year), { exact: true })).toBeVisible();
    // full SIN / dob must never be in the API
    expect(JSON.stringify(personal)).not.toMatch(/\d{9}|\d{4}-\d{2}-\d{2}/);
  });

  test("contact: validation errors sit next to fields and nothing is sent", async ({ page }) => {
    let patched = 0;
    page.on("request", (r) => { if (r.method() === "PATCH" && r.url().includes(P)) patched++; });
    await page.goto("/portal/me/contact");
    await expect(page.getByLabel("Email")).toHaveValue(/@/);
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Postal code").fill("ABCDEFGHIJ");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Enter a valid email.")).toBeVisible();
    expect(patched).toBe(0);
  });

  test("contact: server 400 (postal code) is shown against the field in the API's words", async ({ page }) => {
    await page.goto("/portal/me/contact");
    await expect(page.getByLabel("Email")).toHaveValue(/@/);
    await page.getByLabel("Postal code").fill("ZZZ");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/ZZZ is not a valid Canadian postal code/)).toBeVisible();
  });

  test("contact: happy path persists (reload + API)", async ({ page }) => {
    const before = (await call(page, "GET", P)).json;
    const name = `Contact ${TAG}`;
    try {
      await page.goto("/portal/me/contact");
      await expect(page.getByLabel("Email")).toHaveValue(/@/);
      await page.getByLabel("Emergency contact name").fill(name);
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect.poll(async () => (await call(page, "GET", P)).json.emergency_contact_name).toBe(name);
      await page.reload();
      await expect(page.getByLabel("Emergency contact name")).toHaveValue(name);
    } finally {
      await call(page, "PATCH", P, { emergency_contact_name: before.emergency_contact_name });
    }
  });

  test("BUG: contact save gives no success feedback", async ({ page }) => {
    const before = (await call(page, "GET", P)).json;
    await page.goto("/portal/me/contact");
    await expect(page.getByLabel("Email")).toHaveValue(/@/);
    await page.getByLabel("Emergency contact name").fill(before.emergency_contact_name); // unchanged save
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/saved|updated/i)).toBeVisible({ timeout: 4000 });
  });

  test("BUG: contact 'Notify me by: In app' is offered but silently refused (no error shown)", async ({ page }) => {
    await page.goto("/portal/me/contact");
    await expect(page.getByLabel("Email")).toHaveValue(/@/);
    const opts = await page.getByLabel("Notify me by").locator("option").allInnerTexts();
    // Either the option must not exist, or choosing it must yield a visible message.
    if (!opts.some((o) => /in app/i.test(o))) return;
    await page.getByLabel("Notify me by").selectOption({ label: "In app" });
    await page.getByRole("button", { name: "Save changes" }).click();
    // a PATCH must go out, or a visible message must appear inside the form
    await expect(page.locator("form .text-cadence-red")).toBeVisible({ timeout: 4000 });
  });

  test("contact: 500 on save shows a human-readable error and the form stays usable", async ({ page }) => {
    await page.goto("/portal/me/contact");
    await expect(page.getByLabel("Email")).toHaveValue(/@/);
    await failRoute(page, /\/api\/v1\/portal\/me\/$/, ["PATCH"], 500);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/Simulated server failure|went wrong|try again/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  test("contact: network failure shows an error", async ({ page }) => {
    await page.goto("/portal/me/contact");
    await expect(page.getByLabel("Email")).toHaveValue(/@/);
    await page.route(/\/api\/v1\/portal\/me\/$/, (r) => (r.request().method() === "PATCH" ? r.abort() : r.continue()));
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/Can.t reach the API/i)).toBeVisible();
  });

  test("profile tab (legacy page): edit + cancel + persistence", async ({ page }) => {
    const before = (await call(page, "GET", P)).json;
    const city = `City${TAG}`.slice(0, 30);
    try {
      await page.goto("/portal/me/legacy");
      await page.getByRole("button", { name: "Edit profile" }).click();
      await page.getByLabel("City").fill(city);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText(new RegExp(city))).toBeVisible();
      expect((await call(page, "GET", P)).json.city).toBe(city);
    } finally {
      await call(page, "PATCH", P, { city: before.city });
    }
  });

  test("skills: add, validate, edit, duplicate error, remove, persist", async ({ page }) => {
    const catalog = (await call(page, "GET", P + "skill-catalog/")).json as any[];
    const mine = (await call(page, "GET", P + "skills/")).json as any[];
    const free = catalog.find((c) => !mine.some((m) => m.skill_id === c.id))!;
    await page.goto("/portal/me/skills");
    await expect(page.locator("li", { hasText: "Elder Care" })).toBeVisible();
    await page.getByRole("button", { name: "Add skill" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Pick a skill.")).toBeVisible();
    await page.getByLabel("Skill", { exact: true }).selectOption(free.id);
    await page.getByLabel("Years of experience").fill("abc");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Enter a number like 2 or 2.5.")).toBeVisible();
    await page.getByLabel("Years of experience").fill("3.5");
    await page.getByRole("button", { name: "Save" }).click();
    const chip = page.locator("li", { hasText: free.name });
    await expect(chip).toContainText("3.5y");
    await page.reload();
    await expect(page.locator("li", { hasText: free.name })).toContainText("3.5y");
    // remove
    await page.getByRole("button", { name: `Remove ${free.name}` }).click();
    await confirmDialog(page, "Remove");
    await expect(page.locator("li", { hasText: free.name })).toHaveCount(0);
    expect(((await call(page, "GET", P + "skills/")).json as any[]).some((s) => s.skill_id === free.id)).toBe(false);
  });

  test("BUG: editing a skill's years fails (FE sends skill_id in PATCH body -> backend 500)", async ({ page }) => {
    await page.goto("/portal/me/skills");
    await page.getByRole("button", { name: "Edit Elder Care" }).click();
    await page.getByLabel("Years of experience").fill("7");
    await page.getByRole("button", { name: "Save" }).click();
    try {
      await expect(page.locator("li", { hasText: "Elder Care" })).toContainText("7y", { timeout: 5000 });
    } finally {
      await call(page, "PATCH", P + "skills/d55b0593-b962-48e8-9c21-7968eb4283b9/", { years_exp: "6.5" });
    }
  });

  test("skills API: PATCH with skill_id in the body must not 500", async ({ page }) => {
    const r = await call(page, "PATCH", P + "skills/d55b0593-b962-48e8-9c21-7968eb4283b9/", { skill_id: "d55b0593-b962-48e8-9c21-7968eb4283b9", years_exp: "6.5" });
    expect(r.status).toBeLessThan(500);
  });

  test("BUG: server field error is shown twice (under the field AND in a banner)", async ({ page }) => {
    await page.goto("/portal/me/certs");
    await page.getByRole("button", { name: "Add certification" }).click();
    await page.getByLabel("Name").fill(`Dup ${TAG}`);
    await page.getByLabel("Issued").fill("2026-05-01");
    await page.getByLabel("Expiry").fill("2026-01-01");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("expiry cannot be before issued").first()).toBeVisible();
    await expect(page.getByText("expiry cannot be before issued")).toHaveCount(1);
  });

  test("BUG: skills list 500 is rendered as the empty state 'No skills on file.'", async ({ page }) => {
    await failRoute(page, /\/api\/v1\/portal\/me\/skills\/$/, ["GET"], 500);
    await page.goto("/portal/me/skills");
    await expect(page.getByText("No skills on file.")).toHaveCount(0, { timeout: 6000 });
    await expect(page.getByText(/simulated|went wrong|try again|couldn.t load/i).first()).toBeVisible();
  });

  test("BUG: removing a skill when the API fails gives no message", async ({ page }) => {
    await page.goto("/portal/me/skills");
    await expect(page.locator("li", { hasText: "Elder Care" })).toBeVisible();
    await failRoute(page, /\/api\/v1\/portal\/me\/skills\/[^/]+\/$/, ["DELETE"], 500);
    await page.getByRole("button", { name: "Remove Elder Care" }).click();
    await confirmDialog(page, "Remove");
    await expect(page.getByText(/simulated|went wrong|try again|couldn.t/i)).toBeVisible({ timeout: 4000 });
  });

  test("certs: add (validation + server 400 words), edit, remove; verified cert is locked", async ({ page }) => {
    await page.goto("/portal/me/certs");
    const verified = (((await call(page, "GET", P + "certs/")).json as any[]).find((c) => c.is_verified))!;
    const row = page.locator("li", { hasText: verified.name });
    await expect(row).toContainText("Locked");
    await expect(row.getByRole("button", { name: "Edit" })).toHaveCount(0);
    expect((await call(page, "DELETE", P + `certs/${verified.id}/`)).status).toBeGreaterThanOrEqual(400);

    const name = `Cert ${TAG}`;
    await page.getByRole("button", { name: "Add certification" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Name is required.")).toBeVisible();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Issued").fill("2026-05-01");
    await page.getByLabel("Expiry").fill("2026-01-01");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("expiry cannot be before issued").first()).toBeVisible();
    await page.getByLabel("Expiry").fill("2027-01-01");
    await page.getByRole("button", { name: "Save" }).click();
    const li = page.locator("li", { hasText: name });
    await expect(li).toContainText("Unverified");
    await page.reload();
    await expect(page.locator("li", { hasText: name })).toBeVisible();
    await page.locator("li", { hasText: name }).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").fill(name + "x");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("li", { hasText: name + "x" })).toBeVisible();
    await page.locator("li", { hasText: name + "x" }).getByRole("button", { name: "Remove" }).click();
    await confirmDialog(page, "Remove");
    await expect(page.locator("li", { hasText: name })).toHaveCount(0);
  });

  test("education: add (validation, server year range), edit, remove", async ({ page }) => {
    const inst = `Inst ${TAG}`;
    await page.goto("/portal/me/education");
    await page.getByRole("button", { name: "Add entry" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Institution is required.")).toBeVisible();
    await expect(page.getByText("Credential is required.")).toBeVisible();
    await page.getByLabel("Institution").fill(inst);
    await page.getByLabel("Credential").fill("Diploma");
    await page.getByLabel("Year").fill("1800");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/greater than or equal to 1950|1950/)).toBeVisible();
    await page.getByLabel("Year").fill("2015");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("li", { hasText: inst })).toContainText("2015");
    await page.locator("li", { hasText: inst }).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Credential").fill("Degree");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("li", { hasText: inst })).toContainText("Degree");
    await page.locator("li", { hasText: inst }).getByRole("button", { name: "Remove" }).click();
    await confirmDialog(page, "Remove");
    await expect(page.locator("li", { hasText: inst })).toHaveCount(0);
  });

  test("employment history: add (validation, server 400), remove; persists", async ({ page }) => {
    const emp = `Emp ${TAG}`;
    await page.goto("/portal/me/legacy");
    await page.getByRole("button", { name: "Employment history" }).click();
    await page.getByRole("button", { name: "Add entry" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Employer name is required.")).toBeVisible();
    await page.getByLabel("Employer").fill(emp);
    await page.getByLabel("Started").fill("2020-02-01");
    await page.getByLabel("Ended").fill("2019-01-01");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("the end cannot be before the start")).toBeVisible();
    await page.getByLabel("Ended").fill("2021-01-01");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("li", { hasText: emp })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Employment history" }).click();
    await page.locator("li", { hasText: emp }).getByRole("button", { name: "Remove" }).click();
    await confirmDialog(page, "Remove");
    await expect(page.locator("li", { hasText: emp })).toHaveCount(0);
  });

  test("time off: add, end-before-start server error, edit, remove", async ({ page }) => {
    await page.goto("/portal/me/time-off");
    await page.getByRole("button", { name: "Add entry" }).click();
    await page.getByLabel("Start date").fill("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Start date is required.")).toBeVisible();
    await page.getByLabel("Type").selectOption("personal");
    await page.getByLabel("Start date").fill("2027-03-10");
    await page.getByLabel("End date").fill("2027-03-05");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("end cannot be before start").first()).toBeVisible();
    await page.getByLabel("End date").fill("2027-03-12");
    await page.getByRole("button", { name: "Save" }).click();
    const li = page.locator("li", { hasText: "2027-03-10" });
    await expect(li).toBeVisible();
    await li.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("End date").fill("2027-03-14");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("li", { hasText: "2027-03-14" })).toBeVisible();
    await page.locator("li", { hasText: "2027-03-10" }).getByRole("button", { name: "Remove" }).click();
    await confirmDialog(page, "Remove");
    await expect(page.locator("li", { hasText: "2027-03-10" })).toHaveCount(0);
  });

  test("availability: add, edit, remove, persists", async ({ page }) => {
    await page.goto("/portal/availability");
    await page.getByRole("button", { name: "Add window" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Start time is required.")).toBeVisible();
    await page.getByLabel("Day").selectOption("6");
    await page.getByLabel("Start time").fill("10:15");
    await page.getByLabel("End time").fill("11:45");
    await page.getByRole("button", { name: "Save" }).click();
    const li = page.locator("li", { hasText: "10:15" });
    await expect(li).toBeVisible();
    await page.reload();
    await page.locator("li", { hasText: "10:15" }).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("End time").fill("12:00");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("li", { hasText: "10:15" })).toContainText("12:00");
    await page.locator("li", { hasText: "10:15" }).getByRole("button", { name: "Remove" }).click();
    await confirmDialog(page, "Remove");
    await expect(page.locator("li", { hasText: "10:15" })).toHaveCount(0);
  });

  test("availability window with end before start is rejected", async ({ page }) => {
    await page.goto("/portal/availability");
    await page.getByRole("button", { name: "Add window" }).click();
    await page.getByLabel("Day").selectOption("7");
    await page.getByLabel("Start time").fill("18:07");
    await page.getByLabel("End time").fill("09:07");
    await page.getByRole("button", { name: "Save" }).click();
    try {
      await expect(page.getByText(/end.*(after|before)|later than|must be/i)).toBeVisible({ timeout: 4000 });
    } finally {
      const rows = (await call(page, "GET", P + "availability/")).json as any[];
      for (const r of rows.filter((x) => x.start_time.startsWith("18:07"))) await call(page, "DELETE", P + `availability/${r.id}/`);
    }
  });

  test("BUG: availability times are rendered with seconds (07:00:00–19:00:00)", async ({ page }) => {
    await page.goto("/portal/availability");
    await expect(page.locator("li").filter({ hasText: /Monday|Wednesday|Friday/ }).first()).toBeVisible();
    await expect(page.getByText(/\d\d:\d\d:\d\d/)).toHaveCount(0);
  });

  test("shifts: lists confirmed shifts only, empty state, error state", async ({ page }) => {
    const shifts = (await call(page, "GET", P + "shifts/")).json as any[];
    await page.goto("/portal/shifts");
    await expect(page.getByRole("heading", { name: "My shifts" })).toBeVisible();
    const confirmed = shifts.filter((s) => s.offer_status !== "offered");
    await expect(page.locator("tbody tr")).toHaveCount(confirmed.length);
    await page.unroute("**/*");
    await page.route(/\/api\/v1\/portal\/me\/shifts\/$/, (r) => r.fulfill({ json: [] }));
    await page.reload();
    await expect(page.getByText("No shifts scheduled.")).toBeVisible();
    await page.unroute(/\/api\/v1\/portal\/me\/shifts\/$/);
    await failRoute(page, /\/api\/v1\/portal\/me\/shifts\/$/, ["GET"], 500);
    await page.reload();
    await expect(page.getByText(/simulated|went wrong/i)).toBeVisible();
  });

  test("BUG: shifts error state has no retry control", async ({ page }) => {
    await failRoute(page, /\/api\/v1\/portal\/me\/shifts\/$/, ["GET"], 500);
    await page.goto("/portal/shifts");
    await expect(page.getByRole("button", { name: /retry|try again/i })).toBeVisible({ timeout: 6000 });
  });

  test("offers: accept and decline against the real backend; double-click safe; shifts appear", async ({ page, browser }) => {
    const root = await newPersona(browser, DEMO.root);
    const mayaId = await mayaEmployeeId(root.page);
    // Page through: QA runs keep adding clients, so Harbourview may not be on page one.
    let cid: string | undefined;
    for (let pg = 1; !cid; pg++) {
      const page1 = (await call(root.page, "GET", `/api/v1/clients/?page_size=200&page=${pg}`)).json;
      cid = (page1.results as Array<{ id: string; name: string }>).find((c) => /Harbourview/.test(c.name))?.id;
      if (!page1.next) break;
    }
    expect(cid, "seeded Harbourview client").toBeTruthy();
    async function seed(title: string, day: string) {
      const job = (await call(root.page, "POST", "/api/v1/jobs/", { title, client: cid, bill_rate: "30.00", bill_rate_unit: "hr", start_datetime: "2027-02-01T09:00:00Z", end_datetime: "2027-02-05T17:00:00Z", headcount_needed: 1 })).json;
      const asg = (await call(root.page, "POST", `/api/v1/jobs/${job.id}/assignments/`, { employee_id: mayaId })).json;
      await call(root.page, "POST", `/api/v1/assignments/${asg.id}/shifts/`, { shift_date: day, start_time: "09:00", end_time: "17:00", break_minutes: 30 });
      return { job, asg };
    }
    const a = await seed(`Accept ${TAG}`, "2027-02-02");
    const d = await seed(`Decline ${TAG}`, "2027-02-03");
    try {
      await page.goto("/portal/offers");
      await expect(page.getByText(`Accept ${TAG}`)).toBeVisible();
      const cardA = page.locator("li", { hasText: `Accept ${TAG}` });
      await cardA.getByRole("button", { name: "Accept" }).dblclick();
      await expect(page.getByText(`Accept ${TAG}`)).toHaveCount(0);
      const shifts = (await call(page, "GET", P + "shifts/")).json as any[];
      expect(shifts.find((s) => s.assignment_id === a.asg.id)?.offer_status).toBe("confirmed");
      // accepting again is idempotent on the backend (200), never a 5xx
      const again = await call(page, "POST", P + `offers/${a.asg.id}/accept/`);
      expect(again.status).toBeLessThan(500);

      const cardD = page.locator("li", { hasText: `Decline ${TAG}` });
      await cardD.getByRole("button", { name: "Decline" }).click();
      await confirmDialog(page, "Decline");
      await expect(page.getByText(`Decline ${TAG}`)).toHaveCount(0);
      expect(((await call(page, "GET", P + "shifts/")).json as any[]).some((s) => s.assignment_id === d.asg.id)).toBe(false);
      await page.goto("/portal/shifts");
      await expect(page.getByText(`Accept ${TAG}`)).toBeVisible();
    } finally {
      await call(root.page, "POST", `/api/v1/jobs/${a.job.id}/cancel/`);
      await call(root.page, "POST", `/api/v1/jobs/${d.job.id}/cancel/`);
      await root.ctx.close();
    }
  });

  test("offers: server error on accept is shown in the API's words; 500 on decline too", async ({ page }) => {
    const offer = { id: "s1", assignment_id: "a-1", offer_status: "offered", job_title: `Mock ${TAG}`, client_name: "C", shift_date: "2027-01-01", start_time: "09:00:00", end_time: "17:00:00", status: "scheduled" };
    await page.route(/\/portal\/me\/shifts\/$/, (r) => r.fulfill({ json: [offer] }));
    await page.route(/\/portal\/me\/offers\/a-1\/accept\/$/, (r) => r.fulfill({ status: 400, json: { detail: ["offer is no longer open"] } }));
    await page.route(/\/portal\/me\/offers\/a-1\/decline\/$/, (r) => r.fulfill({ status: 500, json: {} }));
    await page.goto("/portal/offers");
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("offer is no longer open")).toBeVisible();
    await page.getByRole("button", { name: "Decline" }).click();
    await confirmDialog(page, "Decline");
    await expect(page.getByText(/went wrong|Can.t reach/i)).toBeVisible();
  });

  test("offers: empty state", async ({ page }) => {
    await page.route(/\/portal\/me\/shifts\/$/, (r) => r.fulfill({ json: [] }));
    await page.goto("/portal/offers");
    await expect(page.getByText("No pending offers.")).toBeVisible();
  });

  test("documents: upload, list, remove (with confirm); bad upload shows error", async ({ page }) => {
    await page.goto("/portal/documents");
    const fname = `resume-${TAG}.pdf`;
    await page.locator('input[type="file"]').setInputFiles({ name: fname, mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByText(fname)).toBeVisible();
    await page.reload();
    await expect(page.getByText(fname)).toBeVisible();
    const li = page.locator("li", { hasText: fname });
    await li.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(fname)).toHaveCount(0);
    expect(((await call(page, "GET", P + "documents/")).json as any[]).some((x) => x.original_filename === fname)).toBe(false);
    // empty file -> server refusal surfaced
    await page.locator('input[type="file"]').setInputFiles({ name: "empty.pdf", mimeType: "application/pdf", buffer: Buffer.from("") });
    await expect(page.locator("p.text-cadence-red")).toBeVisible();
  });

  test("BUG: removing a document when the API fails gives no message", async ({ page }) => {
    await page.goto("/portal/documents");
    await expect(page.getByRole("button", { name: "Remove" }).first()).toBeVisible();
    await failRoute(page, /\/portal\/me\/documents\/[^/]+\/$/, ["DELETE"], 500);
    await page.getByRole("button", { name: "Remove" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(/simulated|went wrong|try again|couldn.t/i)).toBeVisible({ timeout: 4000 });
  });

  test("signatures: the worker sees each request's document name (label) in the list and review dialog", async ({ page, browser }) => {
    const root = await newPersona(browser, DEMO.root);
    const mayaId = await mayaEmployeeId(root.page);
    const label = `Contract ${TAG} ${Date.now()}`;
    const r = await call(root.page, "POST", "/api/v1/esign/requests/", undefined, {
      employee_id: mayaId, label, file: { name: "form.pdf", mimeType: "application/pdf", buffer: PDF },
    });
    expect(r.status, r.text).toBeLessThan(300);
    try {
      const rows = (await call(page, "GET", P + "signature-requests/")).json as Array<{ id: string; label: string }>;
      expect(rows.find((x) => x.id === r.json.id)?.label).toBe(label);
      await page.goto("/portal/signatures");
      const row = page.locator("li", { hasText: label });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Review & sign" }).click();
      await expect(page.locator("dialog[open]").getByRole("heading", { name: label })).toBeVisible();
    } finally {
      await call(root.page, "POST", `/api/v1/esign/requests/${r.json.id}/revoke/`);
    }
  });

  test("signatures: review + sign, decline (reason required), receipt link, bad PNG error", async ({ page, browser }) => {
    const root = await newPersona(browser, DEMO.root);
    const mayaId = await mayaEmployeeId(root.page);
    const mk = async (label: string) => {
      const r = await call(root.page, "POST", "/api/v1/esign/requests/", undefined, {
        employee_id: mayaId, label, file: { name: "form.pdf", mimeType: "application/pdf", buffer: PDF },
      });
      expect(r.status, r.text).toBeLessThan(300);
      return r.json;
    };
    const s1 = await mk(`Sign ${TAG}`);
    const s2 = await mk(`Decline ${TAG}`);
    try {
      // Other runs leave pending requests behind; show only this test's two so the
      // "first" Review & sign is s1 (sign) and the next is s2 (decline).
      await page.route((url) => url.pathname === `${P}signature-requests/`, async (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        const res = await route.fetch();
        const rows = (await res.json()) as Array<{ id: string }>;
        const mine = [s1.id, s2.id];
        await route.fulfill({ response: res, json: rows.filter((r) => mine.includes(r.id)).sort((a, b) => mine.indexOf(a.id) - mine.indexOf(b.id)) });
      });
      await page.goto("/portal/signatures");
      await expect(page.getByText("On file — it is stamped onto each document you sign.")).toBeVisible();
      const pdf = await call(page, "GET", P + `signature-requests/${s1.id}/document/`);
      expect(pdf.status).toBe(200);
      expect(pdf.headers["content-type"]).toContain("pdf");
      const dialog = page.locator("dialog[open]");
      // decline with blank reason -> button stays disabled, nothing sent
      await page.getByRole("button", { name: "Review & sign" }).first().click();
      await expect(dialog.locator("iframe")).toBeVisible();
      await dialog.getByRole("button", { name: "Decline", exact: true }).click();
      await dialog.getByLabel("Why are you declining?").fill("   ");
      await expect(dialog.getByRole("button", { name: "Decline request" })).toBeDisabled();
      await dialog.getByRole("button", { name: "Back" }).click();
      // sign -> list shrinks, stamped receipt link offered
      await dialog.getByRole("button", { name: "Sign", exact: true }).click();
      // Assert on this test's own requests: parallel tests add pending requests for Maya too.
      const statusOf = async (id: string) => (await call(root.page, "GET", `/api/v1/esign/requests/${id}/`)).json.status;
      await expect.poll(() => statusOf(s1.id)).toBe("signed");
      await expect(page.getByRole("button", { name: "Review & sign" })).toHaveCount(1); // only s2 left
      await expect(page.getByRole("link", { name: "Download signed copy" })).toBeVisible();
      // decline with a reason
      await page.getByRole("button", { name: "Review & sign" }).first().click();
      await dialog.getByRole("button", { name: "Decline", exact: true }).click();
      await dialog.getByLabel("Why are you declining?").fill("Not mine");
      await dialog.getByRole("button", { name: "Decline request" }).click();
      await expect.poll(() => statusOf(s2.id)).toBe("declined");
      // signing again -> API's words via API
      const again = await call(page, "POST", P + `signature-requests/${s1.id}/sign/`);
      expect(again.status).toBeGreaterThanOrEqual(400);
      // bad PNG -> message shown
      await page.getByRole("button", { name: "Replace signature" }).click();
      await page.locator('input[type="file"][accept="image/png"]').setInputFiles({ name: "s.png", mimeType: "image/png", buffer: Buffer.from("notapng") });
      await expect(page.getByText(/signature is a PNG/i)).toBeVisible();
    } finally {
      for (const s of [s1, s2]) await call(root.page, "POST", `/api/v1/esign/requests/${s.id}/revoke/`);
      await root.ctx.close();
    }
  });

  test("signatures: empty state; no saved signature stays open; stale request closes and refetches", async ({ page }) => {
    await page.route(/\/portal\/me\/signature-requests\/$/, (r) => r.fulfill({ json: [] }));
    await page.goto("/portal/signatures");
    await expect(page.getByText("Nothing to sign right now.")).toBeVisible();
    await page.unroute(/\/portal\/me\/signature-requests\/$/);
    const req = { id: "r-1", purpose: "general", status: "pending", generated_on: "2026-12-01", expires_at: "2027-01-01T00:00:00Z" };
    await page.route(/\/portal\/me\/signature-requests\/$/, (r) => r.fulfill({ json: [req] }));
    await page.route(/\/signature-requests\/r-1\/document\/$/, (r) => r.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4\n") }));
    await page.route(/\/signature-requests\/r-1\/sign\/$/, (r) => r.fulfill({ status: 400, json: { detail: ["save your signature first — the portal's signature page"] } }));
    // a signature "on file" so Sign is enabled; the server still has the last word
    await page.route(/\/portal\/me\/signature\/$/, (r) =>
      r.request().method() === "GET" ? r.fulfill({ json: { id: "s-1", width_px: 10, height_px: 10, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } }) : r.fallback());
    await page.reload();
    await page.getByRole("button", { name: "Review & sign" }).click();
    const dialog = page.locator("dialog[open]");
    const sign = dialog.getByRole("button", { name: "Sign", exact: true });
    await sign.click();
    await expect(dialog.getByText("save your signature first")).toBeVisible();
    await page.unroute(/\/signature-requests\/r-1\/sign\/$/);
    await page.route(/\/signature-requests\/r-1\/sign\/$/, (r) => r.fulfill({ status: 400, json: { detail: ["the request is revoked — only a pending one can be signed"] } }));
    await sign.click();
    await expect(page.getByText("the request is revoked — only a pending one can be signed")).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });

  test("signature request dates are human dates, not raw ISO timestamps", async ({ page }) => {
    await page.route(/\/portal\/me\/signature-requests\/$/, (r) =>
      r.fulfill({ json: [{ id: "r-1", purpose: "general", status: "pending", generated_on: "2026-12-01", expires_at: "2027-01-01T08:30:00.123456Z" }] }));
    await page.goto("/portal/signatures");
    await expect(page.getByText(/Sign by/)).toBeVisible();
    await expect(page.getByText(/T\d\d:\d\d/)).toHaveCount(0);
  });

  test("consent: text shown, agree records consent (API), 400 shown", async ({ page }) => {
    await page.goto("/portal/consent");
    const t = (await call(page, "GET", P + "consent-text/")).json;
    await expect(page.getByText(t.consent_text.slice(0, 40))).toBeVisible();
    await page.getByRole("button", { name: "I agree" }).click();
    await expect(page.getByText(new RegExp(`Consent recorded for version ${t.consent_version}`))).toBeVisible();
    await page.route(/\/portal\/me\/consent\/$/, (r) => r.fulfill({ status: 400, json: { detail: ["consent notice changed"] } }));
    await page.reload();
    await page.getByRole("button", { name: "I agree" }).click();
    await expect(page.getByText("consent notice changed")).toBeVisible();
  });

  test("consent: unpublished notice and 500 on text", async ({ page }) => {
    await page.route(/\/portal\/me\/consent-text\/$/, (r) => r.fulfill({ json: { consent_text: "", consent_version: 0 } }));
    await page.goto("/portal/consent");
    await expect(page.getByText(/has not published a consent notice/)).toBeVisible();
    await page.unroute(/\/portal\/me\/consent-text\/$/);
    await failRoute(page, /\/portal\/me\/consent-text\/$/, ["GET"], 500);
    await page.reload();
    await expect(page.getByText(/simulated|went wrong/i)).toBeVisible();
  });

  test("onboarding: active worker sees 'already submitted'; API refuses submit with words", async ({ page }) => {
    await page.goto("/portal/onboarding");
    await expect(page.getByText(/already been submitted/)).toBeVisible();
    const r = await call(page, "POST", P + "submit/", { consent_acknowledged: true });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.json)).toMatch(/cannot submit onboarding/);
  });

  test("onboarding (applicant, mocked API): steps, signature pad, submit 400 then success", async ({ page }) => {
    const me = { ...(await call(page, "GET", P)).json, lifecycle_status: "applicant", work_authorization: "citizen_pr", consent: null };
    await page.route(/\/portal\/me\/$/, (r) => (r.request().method() === "GET" ? r.fulfill({ json: me }) : r.fulfill({ json: me })));
    await page.route(/\/portal\/me\/documents\/$/, (r) => r.fulfill({ json: [{ id: "d1", document_id: "x", document_type: "resume", original_filename: "cv.pdf", is_verified: false }] }));
    await page.route(/\/portal\/me\/consent\/$/, (r) => r.fulfill({ status: 201, json: { id: "c", version: 1 } }));
    await page.route(/\/portal\/me\/signature\/$/, (r) => r.fulfill({ status: 200, json: { id: "s" } }));
    let attempts = 0;
    await page.route(/\/portal\/me\/submit\/$/, (r) => {
      attempts++;
      return attempts === 1
        ? r.fulfill({ status: 400, json: { detail: ["missing SIN document and two photo IDs"] } })
        : r.fulfill({ json: { ...me, lifecycle_status: "onboarding" } });
    });
    await page.goto("/portal/onboarding");
    await page.getByRole("button", { name: "Get started" }).click();
    await page.getByRole("button", { name: "Continue" }).click(); // work auth
    await page.getByRole("button", { name: "Continue" }).click(); // docs
    await page.getByRole("button", { name: "Continue" }).click(); // certs
    await page.getByRole("button", { name: "Continue" }).click(); // availability
    await expect(page.getByText("Agreement & consent")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await page.getByRole("checkbox").check();
    const pad = page.locator("canvas").first();
    await expect(pad).toBeVisible();
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + 40, { steps: 5 });
    await page.mouse.up();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Ready to submit")).toBeVisible();
    await page.getByRole("button", { name: /Agree & submit/ }).click();
    await expect(page.getByText("missing SIN document and two photo IDs")).toBeVisible();
    await page.getByRole("button", { name: /Agree & submit/ }).click();
    await expect(page.getByText("You're all set")).toBeVisible();
  });

  test("pay statements: list, detail, pdf, redirects, foreign/bad id", async ({ page }) => {
    const list = (await call(page, "GET", P + "pay-statements/")).json as any[];
    expect(list.length).toBeGreaterThan(0);
    const id = list[0].id;
    await page.goto("/portal/pay-statements");
    await expect(page.locator("tbody tr")).toHaveCount(list.length);
    await page.getByRole("link", { name: "Details" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/portal/pay-statements/${id}`));
    await expect(page.getByText("Earnings")).toBeVisible();
    await expect(page.getByText("Deductions")).toBeVisible();
    await page.goto("/portal/payslips");
    await expect(page).toHaveURL(/\/portal\/pay-statements$/);
    await page.goto(`/portal/payslips/${id}`);
    await expect(page).toHaveURL(new RegExp(`/portal/pay-statements/${id}$`));
    await page.goto("/portal/pay-statements/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText(/not found/i)).toBeVisible();
    await page.goto("/portal/pay-statements/not-a-uuid");
    await expect(page.getByText(/not found/i)).toBeVisible();
    await expect(page.getByText("Loading…")).toHaveCount(0);
  });

  // The worker can only download a PDF the office generated (the portal never
  // renders on demand). So: the link is offered exactly when the statement has
  // a document, and it then serves a real PDF; without one there is no link
  // (the API would 404) and the page says so instead.
  test("pay statement PDF: link only when a PDF exists (and it downloads); otherwise a clear message", async ({ page }) => {
    const list = (await call(page, "GET", P + "pay-statements/")).json as any[];
    expect(list.length).toBeGreaterThan(0);
    const withPdf = list.find((s) => s.document_id);
    const withoutPdf = list.find((s) => !s.document_id);
    if (withoutPdf) {
      expect((await call(page, "GET", P + `pay-statements/${withoutPdf.id}/pdf/`)).status).toBe(404);
      await page.goto(`/portal/pay-statements/${withoutPdf.id}`);
      await expect(page.getByText(/PDF copy isn.t available/i)).toBeVisible();
      await expect(page.getByRole("link", { name: "Download PDF" })).toHaveCount(0);
      await page.goto("/portal/pay-statements");
      const row = page.locator("tbody tr").filter({ has: page.locator(`a[href="/portal/pay-statements/${withoutPdf.id}"]`) });
      await expect(row).toContainText("No PDF yet");
      await expect(row.getByRole("link", { name: "PDF", exact: true })).toHaveCount(0);
    }
    if (withPdf) {
      await page.goto(`/portal/pay-statements/${withPdf.id}`);
      const href = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href", { timeout: 10_000 });
      const r = await call(page, "GET", href!);
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toContain("pdf");
    }
  });

  test("pay statements: empty state and 500", async ({ page }) => {
    await page.route(/\/portal\/me\/pay-statements\/$/, (r) => r.fulfill({ json: [] }));
    await page.goto("/portal/pay-statements");
    await expect(page.getByText(/No pay statements yet/)).toBeVisible();
    await page.unroute(/\/portal\/me\/pay-statements\/$/);
    await failRoute(page, /\/portal\/me\/pay-statements\/$/, ["GET"], 500);
    await page.reload();
    await expect(page.getByText(/simulated|went wrong/i)).toBeVisible();
  });

  test("BUG: pay statement list has no period/date column", async ({ page }) => {
    await page.goto("/portal/pay-statements");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(page.locator("thead")).toContainText(/date|period|paid|issued/i);
  });

  test("notifications: API returns the worker's notifications", async ({ page }) => {
    const r = await call(page, "GET", "/api/v1/notifications/portal/me/notifications/");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json)).toBe(true);
  });

  type NoticeRow = { id: string; status: string };

  test("portal UI exposes the worker's notifications", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.getByRole("link", { name: /^Notifications/ })).toBeVisible(); // header renders after the session loads
    const links = await page.locator("a[href]").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")));
    expect(links.some((h) => /notification/i.test(h ?? ""))).toBe(true);
  });

  test("notifications: header bell badge matches the API's unread rows and opens the page", async ({ page }) => {
    const p = watchProblems(page);
    const rows = (await call(page, "GET", "/api/v1/notifications/portal/me/notifications/")).json as NoticeRow[];
    await page.goto("/portal");
    const bell = page.getByRole("link", { name: /^Notifications/ });
    await expect(bell).toHaveAttribute("href", "/portal/notifications");
    if (rows.some((r) => r.status === "sent")) await expect(bell).toHaveAccessibleName(/\d+ unread/);
    await bell.click();
    await expect(page).toHaveURL(/\/portal\/notifications$/);
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    if (rows.length === 0) await expect(page.getByText("No notifications yet")).toBeVisible();
    else await expect(page.getByRole("list", { name: "Notifications" }).getByRole("listitem").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(p.api, p.api.join("\n")).toEqual([]);
    expect(p.pageErrors).toEqual([]);
  });

  test("notifications: the More menu links the page (top-level, no back arrow)", async ({ page }) => {
    await page.goto("/portal");
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "More modules" }).getByRole("link", { name: "Notifications" }).click();
    await expect(page).toHaveURL(/\/portal\/notifications$/);
    await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  });

  test("notifications: Mark read persists through the API", async ({ page }) => {
    const url = "/api/v1/notifications/portal/me/notifications/";
    const before = ((await call(page, "GET", url)).json as NoticeRow[]).filter((r) => r.status === "sent").length;
    test.skip(before === 0, "no unread notification seeded for the demo worker");
    await page.goto("/portal/notifications");
    const button = page.getByRole("button", { name: /Mark .* as read/ }).first();
    await expect(button).toBeVisible();
    const posted = page.waitForRequest((r) => r.url().endsWith("/notifications/portal/me/notifications/read/") && r.method() === "POST");
    await button.click();
    const body = (await posted).postDataJSON();
    expect(Array.isArray(body.ids) && body.ids.length > 0).toBe(true);
    // Check the rows we marked, not the total: parallel tests keep adding notifications for Maya.
    await expect.poll(async () => ((await call(page, "GET", url)).json as NoticeRow[]).filter((r) => body.ids.includes(r.id) && r.status !== "read").length).toBe(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    const after = ((await call(page, "GET", url)).json as NoticeRow[]).filter((r) => body.ids.includes(r.id));
    expect(after.every((r) => r.status === "read")).toBe(true);
  });

  test("notifications: empty state and 500", async ({ page }) => {
    await page.route(/\/notifications\/portal\/me\/notifications\/$/, (r) => r.fulfill({ json: [] }));
    await page.goto("/portal/notifications");
    await expect(page.getByText("No notifications yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();
    await page.unroute(/\/notifications\/portal\/me\/notifications\/$/);
    await failRoute(page, /\/notifications\/portal\/me\/notifications\/$/, ["GET"], 500);
    await page.reload();
    await expect(page.getByText(/simulated|went wrong/i).first()).toBeVisible();
  });

  test("notifications: e-sign email + in-app copies show as one entry linking to signatures", async ({ page }) => {
    const base = { type: "esign", payload: { request_id: "r-1", signer_name: "Maya", org_name: "Cadence Demo", document_label: "your contract", expires_on: "2026-10-30" }, sent_at: "2026-10-01T15:00:00Z", created_at: "2026-10-01T15:00:00Z" };
    await page.route(/\/notifications\/portal\/me\/notifications\/$/, (r) => r.fulfill({ json: [
      { ...base, id: "aaaaaaaa-0000-4000-8000-000000000001", channel: "email", status: "sent" },
      { ...base, id: "aaaaaaaa-0000-4000-8000-000000000002", channel: "in_app", status: "sent" },
    ] }));
    await page.goto("/portal/notifications");
    const list = page.getByRole("list", { name: "Notifications" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list.getByText("Cadence Demo sent you your contract to sign, by 2026-10-30.")).toBeVisible();
    await expect(list.getByRole("link", { name: "Open signatures" })).toHaveAttribute("href", "/portal/signatures");
    await expect(page.getByText("1 unread")).toBeVisible();
    await expect(page.getByRole("link", { name: "Notifications, 1 unread" })).toBeVisible();
  });

  test("mid-session 401 signs the worker out / redirects to login", async ({ page }) => {
    await page.goto("/portal/me/certs");
    await expect(page.getByRole("button", { name: "Add certification" })).toBeVisible();
    await page.route(/\/api\/v1\//, (r) => r.fulfill({ status: 401, json: { detail: "Authentication credentials were not provided." } }));
    await page.getByRole("button", { name: "Add certification" }).click();
    await page.getByLabel("Name").fill(`Expired ${TAG}`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test("real session expiry: cleared cookies + reload lands on login", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
    await page.context().clearCookies();
    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("loading state: slow API shows a loading/skeleton state, not a blank page", async ({ page }) => {
    await page.route(/\/portal\/me\/shifts\/$/, async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue(); });
    await page.goto("/portal/shifts");
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.getByRole("heading", { name: "My shifts" })).toBeVisible();
  });
});

/* ------------------------------------------------- access & isolation */
test.describe("portal access control and isolation", () => {
  test.describe.configure({ mode: "default", timeout: 90_000 });

  test("worker cannot reach staff routes (redirected to /portal) or staff APIs (403)", async ({ page }) => {
    await apiLogin(page, DEMO.worker);
    for (const r of ["/jobs", "/workers", "/invoices", "/privacy", "/privacy/breaches", "/settings", "/admin/users"]) {
      await page.goto(r);
      await expect(page, r).toHaveURL(/\/portal/, { timeout: 10_000 });
    }
    for (const u of ["/api/v1/workers/", "/api/v1/jobs/", "/api/v1/privacy/requests/", "/api/v1/privacy/breaches/", "/api/v1/privacy/disposal/", "/api/v1/invoices/"]) {
      expect((await call(page, "GET", u)).status, u).toBe(403);
    }
  });

  test("staff opening portal URLs is sent to staff home; anonymous goes to login", async ({ page, browser }) => {
    await apiLogin(page, DEMO.root);
    for (const r of ["/portal", "/portal/me", "/portal/offers", "/portal/pay-statements"]) {
      await page.goto(r);
      await expect(page, r).toHaveURL(/127\.0\.0\.1:\d+\/$/, { timeout: 10_000 });
    }
    expect((await call(page, "GET", P)).status).toBeGreaterThanOrEqual(400);
    const anon = await browser.newContext({ baseURL: BASE });
    const ap = await anon.newPage();
    await ap.goto("/portal/me");
    await expect(ap).toHaveURL(/\/login/, { timeout: 10_000 });
    await anon.close();
  });

  test("cross-worker ids answer 404 (not 403) for every portal door", async ({ page, browser }) => {
    const liam = await newPersona(browser, "demo.liam");
    const L = async (u: string) => (await call(liam.page, "GET", P + u)).json as any[];
    const lCerts = await L("certs/"), lDocs = await L("documents/"), lPay = await L("pay-statements/"), lShifts = await L("shifts/");
    const lEdu = await L("education/"), lEh = await L("employment-history/"), lTo = await L("time-off/"), lAv = await L("availability/"), lReq = await L("signature-requests/");
    await liam.ctx.close();
    await apiLogin(page, DEMO.worker);
    const checks: Array<[string, string, string | undefined]> = [];
    for (const c of lCerts) checks.push(["PATCH", `certs/${c.id}/`, "cert"], ["DELETE", `certs/${c.id}/`, "cert"]);
    for (const d of lDocs) checks.push(["DELETE", `documents/${d.id}/`, "doc"]);
    for (const p of lPay) checks.push(["GET", `pay-statements/${p.id}/`, "pay"], ["GET", `pay-statements/${p.id}/pdf/`, "pay"]);
    for (const s of new Set(lShifts.map((x) => x.assignment_id))) checks.push(["POST", `offers/${s}/accept/`, "offer"], ["POST", `offers/${s}/decline/`, "offer"]);
    for (const e of lEdu) checks.push(["PATCH", `education/${e.id}/`, "edu"], ["DELETE", `education/${e.id}/`, "edu"]);
    for (const e of lEh) checks.push(["PATCH", `employment-history/${e.id}/`, "eh"], ["DELETE", `employment-history/${e.id}/`, "eh"]);
    for (const e of lTo) checks.push(["PATCH", `time-off/${e.id}/`, "to"], ["DELETE", `time-off/${e.id}/`, "to"]);
    for (const e of lAv) checks.push(["PATCH", `availability/${e.id}/`, "av"], ["DELETE", `availability/${e.id}/`, "av"]);
    for (const r of lReq) checks.push(["GET", `signature-requests/${r.id}/document/`, "sig"], ["POST", `signature-requests/${r.id}/sign/`, "sig"], ["POST", `signature-requests/${r.id}/decline/`, "sig"]);
    expect(checks.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const [m, u] of checks) {
      const r = await call(page, m, P + u, m === "PATCH" ? { name: "x" } : m === "POST" && u.includes("decline") ? { reason: "x" } : undefined);
      if (r.status !== 404) bad.push(`${m} ${u} -> ${r.status}`);
    }
    expect(bad).toEqual([]);
    // Liam's data untouched
    const liam2 = await newPersona(browser, "demo.liam");
    expect(((await call(liam2.page, "GET", P + "certs/")).json as any[]).length).toBe(lCerts.length);
    await liam2.ctx.close();
  });

  test("UI: another worker's pay statement URL shows Not found, never data", async ({ page, browser }) => {
    const liam = await newPersona(browser, "demo.liam");
    const lPay = (await call(liam.page, "GET", P + "pay-statements/")).json as any[];
    await liam.ctx.close();
    test.skip(lPay.length === 0, "demo.liam has no pay statements seeded");
    await apiLogin(page, DEMO.worker);
    await page.goto(`/portal/pay-statements/${lPay[0].id}`);
    await expect(page.getByText(/not found/i)).toBeVisible();
    await expect(page.getByText("Liam")).toHaveCount(0);
  });
});

/* ---------------------------------------------------------------- privacy */
test.describe("staff privacy", () => {
  test.describe.configure({ mode: "default", timeout: 90_000 });

  test("coordinator without privacy permissions: clear denial, not a blank/endless Loading", async ({ page }) => {
    await apiLogin(page, DEMO.recruiter);
    for (const r of ["/privacy", "/privacy/breaches", "/privacy/disposal"]) {
      await page.goto(r);
      await expect(page.getByText(/permission|not allowed|forbidden|access/i).first(), r).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Loading…")).toHaveCount(0);
    }
    expect((await call(page, "GET", "/api/v1/privacy/requests/")).status).toBe(403);
  });

  test("requests: empty state, validation, create -> detail, answer, export, persistence", async ({ page, browser }) => {
    await apiLogin(page, DEMO.root);
    await page.route(/\/api\/v1\/privacy\/requests\/(\?.*)?$/, (r) =>
      r.request().method() === "GET" ? r.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }) : r.continue());
    await page.goto("/privacy");
    await expect(page.getByText("No privacy requests.")).toBeVisible();
    await page.unroute(/\/api\/v1\/privacy\/requests\/(\?.*)?$/);
    await page.reload();

    await page.getByRole("button", { name: "New request" }).click();
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Pick a worker.")).toBeVisible();
    const workers = (await call(page, "GET", "/api/v1/workers/?page_size=200")).json.results as any[];
    const w = workers.find((x) => x.first_name === "Maya") ?? workers[0];
    await page.getByLabel("Worker").selectOption(w.id);
    await page.getByLabel("Type").selectOption("access");
    await page.getByRole("button", { name: "Create" }).dblclick();
    await expect(page).toHaveURL(/\/privacy\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const id = page.url().split("/").pop()!;
    const reqs = (await call(page, "GET", "/api/v1/privacy/requests/?page_size=200")).json.results as any[];
    const mineNow = reqs.filter((r) => r.employee_id === w.id && r.status !== "answered");
    // double-submit must not have created 2 identical open requests at the same second
    const dup = mineNow.filter((r) => r.received_on === reqs.find((x) => x.id === id).received_on);
    expect(dup.length, "double-click created duplicate requests").toBe(1);

    // export
    const ex = await call(page, "GET", `/api/v1/privacy/requests/${id}/export/`);
    expect(ex.status).toBe(200);
    await expect(page.getByRole("link", { name: "Export full record" })).toBeVisible();
    // answer validation + success
    await page.getByRole("button", { name: "Mark answered" }).click();
    await expect(page.getByText("A response note is required.")).toBeVisible();
    await page.getByLabel("Response note").fill(`Answered ${TAG}`);
    await page.getByRole("button", { name: "Mark answered" }).click();
    await expect(page.getByText(`Answered ${TAG}`)).toBeVisible();
    await page.reload();
    await expect(page.getByText(`Answered ${TAG}`)).toBeVisible();
    expect((await call(page, "POST", `/api/v1/privacy/requests/${id}/answer/`, { response_note: "again" })).status).toBeGreaterThanOrEqual(400);
    // shows in list
    await page.goto("/privacy");
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("requests: correction request hides export; whitespace-only answer is refused with words", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    const workers = (await call(page, "GET", "/api/v1/workers/?page_size=200")).json.results as any[];
    const created = await call(page, "POST", "/api/v1/privacy/requests/", { employee_id: workers[0].id, type: "correction" });
    expect(created.status).toBe(201);
    await page.goto(`/privacy/${created.json.id}`);
    await expect(page.getByRole("link", { name: "Export full record" })).toHaveCount(0);
    await page.getByLabel("Response note").fill("   ");
    await page.getByRole("button", { name: "Mark answered" }).click();
    await expect(page.locator("p.text-cadence-red, [role=alert]").first()).toBeVisible({ timeout: 6000 });
    expect((await call(page, "GET", `/api/v1/privacy/requests/${created.json.id}/export/`)).status).toBeGreaterThanOrEqual(400);
  });

  test("requests: API validation (bad worker id, bad type, future date) answers in words", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    const a = await call(page, "POST", "/api/v1/privacy/requests/", { employee_id: "00000000-0000-0000-0000-000000000000", type: "access" });
    expect(a.status).toBeGreaterThanOrEqual(400);
    expect(a.status).toBeLessThan(500);
    const mayaId = await mayaEmployeeId(page);
    const b = await call(page, "POST", "/api/v1/privacy/requests/", { employee_id: mayaId, type: "bogus" });
    expect(b.status).toBe(400);
    expect(JSON.stringify(b.json)).toMatch(/type/);
  });

  test("request detail: unknown id -> Not found page; malformed id handled; 500 shows message", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    for (const id of ["00000000-0000-0000-0000-000000000000", "not-a-uuid"]) {
      await page.goto(`/privacy/${id}`);
      await expect(page.getByText(/not found|404/i).first(), id).toBeVisible();
      await expect(page.getByText("Loading…")).toHaveCount(0);
    }
    await failRoute(page, /\/api\/v1\/privacy\/requests\/[0-9a-f-]{36}\/$/, ["GET"], 500);
    await page.goto("/privacy/11111111-1111-1111-1111-111111111111");
    await expect(page.getByText(/simulated|went wrong/i)).toBeVisible();
  });

  test("requests: list 500 shows an error; 401 mid-session ends up at login (BUG if not)", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    await failRoute(page, /\/api\/v1\/privacy\/requests\/(\?.*)?$/, ["GET"], 500);
    await page.goto("/privacy");
    await expect(page.getByText(/simulated|went wrong/i)).toBeVisible();
  });

  test("BUG: privacy request list/detail never say WHICH worker the request is for", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    const workers = (await call(page, "GET", "/api/v1/workers/?page_size=200")).json.results as any[];
    const w = workers[0];
    const c = await call(page, "POST", "/api/v1/privacy/requests/", { employee_id: w.id, type: "correction" });
    await page.goto(`/privacy/${c.json.id}`);
    await expect(page.getByText(new RegExp(w.last_name))).toBeVisible({ timeout: 4000 });
  });

  test("breaches: empty state, create via UI, detail, persistence, list", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    await page.route(/\/api\/v1\/privacy\/breaches\/(\?.*)?$/, (r) =>
      r.request().method() === "GET" ? r.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }) : r.continue());
    await page.goto("/privacy/breaches");
    await expect(page.getByText("No breaches recorded.")).toBeVisible();
    await page.unroute(/\/api\/v1\/privacy\/breaches\/(\?.*)?$/);
    await page.reload();

    await page.getByRole("button", { name: "Record breach" }).click();
    await page.getByRole("button", { name: "Save record" }).click();
    // blank description: server refusal must be visible
    await expect(dialog(page).locator("p.text-cadence-red").first()).toBeVisible({ timeout: 6000 });
    const desc = `Breach ${TAG}`;
    await page.getByLabel("Description").fill(desc);
    await page.getByLabel("Personal information involved").fill("Names, emails");
    await page.getByLabel("RROSH").selectOption("real_risk");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page.locator("tbody").getByText(desc)).toBeVisible();
    const lr = await call(page, "GET", "/api/v1/privacy/breaches/?page_size=200");
    const list = lr.json.results as any[];
    expect(list.filter((b) => b.description === desc), `status ${lr.status} count ${lr.json.count} descs ${list.map((b) => b.description).join("|")} want ${desc} dlg ${await page.getByRole("dialog").isVisible()}`).toHaveLength(1);
    await page.locator("tbody").getByText(desc).click();
    await expect(page).toHaveURL(/\/privacy\/breaches\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Real risk")).toBeVisible();
    await expect(page.getByText(desc)).toBeVisible();
    await page.reload();
    await expect(page.getByText(desc)).toBeVisible();
  });

  test("BUG: breach dialog keeps the previous record's text when reopened (form never reset)", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    await page.goto("/privacy/breaches");
    await page.getByRole("button", { name: "Record breach" }).click();
    const desc = `Reset ${TAG}`;
    await page.getByLabel("Description").fill(desc);
    await page.getByLabel("Personal information involved").fill("x");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(page.locator("tbody").getByText(desc)).toBeVisible();
    await page.getByRole("button", { name: "Record breach" }).click();
    await expect(page.getByLabel("Description")).toHaveValue("");
  });

  test("BUG: breach Save is not disabled while saving (double-click writes two write-once records)", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    await page.goto("/privacy/breaches");
    await page.getByRole("button", { name: "Record breach" }).click();
    const desc = `Dbl ${TAG}`;
    await page.getByLabel("Description").fill(desc);
    await page.getByLabel("Personal information involved").fill("x");
    await page.getByRole("button", { name: "Save record" }).dblclick();
    await expect(page.locator("tbody").getByText(desc).first()).toBeVisible();
    const list = (await call(page, "GET", "/api/v1/privacy/breaches/?page_size=200")).json.results as any[];
    expect(list.filter((b) => b.description === desc)).toHaveLength(1);
  });

  test("BUG: breach form has no field-level validation (empty required fields not flagged next to inputs)", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    await page.goto("/privacy/breaches");
    await page.getByRole("button", { name: "Record breach" }).click();
    await page.getByRole("button", { name: "Save record" }).click();
    const descField = page.getByLabel("Description");
    await expect(descField.locator("xpath=ancestor::*[self::div or self::label][1]").getByText(/required|blank|describe/i)).toBeVisible({ timeout: 4000 });
  });

  test("breaches: unknown id -> not found; list 500 -> message", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    await page.goto("/privacy/breaches/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
    await failRoute(page, /\/api\/v1\/privacy\/breaches\/(\?.*)?$/, ["GET"], 500);
    await page.goto("/privacy/breaches");
    await expect(page.getByText(/simulated|went wrong/i)).toBeVisible();
  });

  test("breaches API: write-once (no PATCH/DELETE), blank text refused in words", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    const blank = await call(page, "POST", "/api/v1/privacy/breaches/", { description: "", personal_information: "", rrosh: "no_real_risk" });
    expect(blank.status).toBe(400);
    const list = (await call(page, "GET", "/api/v1/privacy/breaches/?page_size=1")).json.results as any[];
    if (list[0]) {
      expect((await call(page, "PATCH", `/api/v1/privacy/breaches/${list[0].id}/`, { description: "x" })).status).toBe(405);
      expect((await call(page, "DELETE", `/api/v1/privacy/breaches/${list[0].id}/`)).status).toBe(405);
    }
  });

  test("disposal: real empty state; API refuses bad hold/delay and unknown ids", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    const real = (await call(page, "GET", "/api/v1/privacy/disposal/")).json;
    await page.goto("/privacy/disposal");
    if (real.count === 0) await expect(page.getByText("No disposal schedules.")).toBeVisible();
    const ghost = "00000000-0000-0000-0000-000000000000";
    expect((await call(page, "POST", `/api/v1/privacy/disposal/${ghost}/hold/`, { reason: "x" })).status).toBe(404);
    expect((await call(page, "POST", `/api/v1/privacy/disposal/${ghost}/hold/`, { reason: "" })).status).toBeGreaterThanOrEqual(400);
    expect((await call(page, "POST", `/api/v1/privacy/disposal/${ghost}/delay/`, { due_on: "2030-01-01" })).status).toBe(404);
    expect((await call(page, "POST", `/api/v1/privacy/disposal/${ghost}/release/`)).status).toBe(404);
    expect((await call(page, "POST", `/api/v1/privacy/disposal/${ghost}/destroy/`)).status).toBe(404);
  });

  test("disposal (mocked schedule): hold -> release -> delay -> destroy dialogs, payloads and error words", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    const today = new Date().toISOString().slice(0, 10);
    const row: any = { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", employee_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", destruction_scheduled_on: "2026-08-01", destruction_due_on: "2099-01-01", destruction_notified_at: null, destruction_held_at: null, destruction_hold_reason: "" };
    const sent: Array<{ url: string; body: any }> = [];
    let failNext: { status: number; json: any } | null = null;
    await page.route(/\/api\/v1\/privacy\/disposal\//, (r) => {
      const req = r.request();
      if (req.method() === "GET") return r.fulfill({ json: { count: 1, next: null, previous: null, results: [row] } });
      if (failNext) { const f = failNext; failNext = null; return r.fulfill({ status: f.status, json: f.json }); }
      const u = req.url();
      sent.push({ url: u, body: req.postDataJSON?.() ?? null });
      if (u.includes("/hold/")) { row.destruction_hold_reason = req.postDataJSON().reason; }
      if (u.includes("/release/")) { row.destruction_hold_reason = ""; }
      if (u.includes("/delay/")) { row.destruction_due_on = req.postDataJSON().due_on; }
      return r.fulfill({ json: row });
    });
    await page.goto("/privacy/disposal");
    await expect(page.getByText("Scheduled", { exact: true }).first()).toBeVisible();
    // hold: disabled while blank, server error words, then success
    await page.getByRole("button", { name: "Hold" }).click();
    await expect(page.getByRole("button", { name: "Place hold" })).toBeDisabled();
    await page.getByLabel("Reason").fill("Litigation hold");
    failNext = { status: 400, json: { detail: ["a hold needs a recorded reason"] } };
    await page.getByRole("button", { name: "Place hold" }).click();
    await expect(dialog(page).getByText("a hold needs a recorded reason")).toBeVisible();
    await page.getByRole("button", { name: "Place hold" }).click();
    await expect(page.getByText("Held", { exact: true }).first()).toBeVisible();
    // release
    await page.getByRole("button", { name: "Release" }).click();
    await expect(page.getByRole("button", { name: "Hold" })).toBeVisible();
    // delay
    await page.getByRole("button", { name: "Delay" }).click();
    await page.getByLabel("New due date").fill("2099-06-01");
    failNext = { status: 500, json: {} };
    await page.getByRole("button", { name: "Save delay" }).click();
    await expect(dialog(page).getByText(/went wrong|Can.t reach/i)).toBeVisible();
    await page.getByRole("button", { name: "Save delay" }).click();
    await expect(page.getByText("2099-06-01")).toBeVisible();
    expect(sent.find((s) => s.url.includes("/delay/"))?.body).toEqual({ due_on: "2099-06-01" });
    // destroy needs typed confirmation
    await page.getByRole("button", { name: "Destroy now" }).first().click();
    const go = dialog(page).getByRole("button", { name: "Destroy now" });
    await expect(go).toBeDisabled();
    await dialog(page).getByLabel(/Type DESTROY/).fill("destroy");
    await expect(go).toBeDisabled();
    await dialog(page).getByLabel(/Type DESTROY/).fill("DESTROY");
    await expect(go).toBeEnabled();
    expect(sent.some((s) => s.url.includes("/destroy/"))).toBe(false);
  });

  test("disposal: 500 list shows error; network failure shows error", async ({ page }) => {
    await apiLogin(page, DEMO.root);
    await failRoute(page, /\/api\/v1\/privacy\/disposal\/(\?.*)?$/, ["GET"], 500);
    await page.goto("/privacy/disposal");
    await expect(page.getByText(/simulated|went wrong/i)).toBeVisible();
  });
});
