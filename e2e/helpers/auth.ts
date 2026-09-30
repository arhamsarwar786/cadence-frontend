import { expect, type Page } from "@playwright/test";

/** Deterministic demo credentials from Backend/core/seed_demo.py (local dev DB only). */
export const DEMO = {
  password: "demo-only-access",
  root: "root@cadence-demo.example",
  recruiter: "recruiter@cadence-demo.example",
  worker: "demo.maya",
} as const;

/** Real login through the UI (agency picker -> credentials). No mocks. */
export async function loginAsStaff(page: Page, email: string) {
  await page.goto("/login/agency");
  await page.getByRole("button", { name: /Cadence Demo/i }).click();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(DEMO.password);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
}

/** Faster: authenticate via the same proxy the UI uses, session cookie lands in the context. */
export async function apiLogin(page: Page, login: string) {
  const first = await page.request.get("/api/v1/auth/me/");
  const csrf = (await page.context().cookies()).find((c) => c.name === "csrftoken")?.value ?? "";
  const res = await page.request.post("/api/v1/auth/login/", {
    data: { login, password: DEMO.password },
    headers: { "X-CSRFToken": csrf },
  });
  expect(res.ok(), `login ${login}: ${first.status()} -> ${res.status()} ${await res.text()}`).toBeTruthy();
}

export interface PageProblems {
  api: string[];
  console: string[];
  pageErrors: string[];
}

/** Collect every failed /api/v1 call, console error and uncaught exception on a page. */
export function watchProblems(page: Page): PageProblems {
  const p: PageProblems = { api: [], console: [], pageErrors: [] };
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/api/v1/") && r.status() >= 400) {
      p.api.push(`${r.request().method()} ${new URL(u).pathname}${new URL(u).search} -> ${r.status()}`);
    }
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) p.console.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => p.pageErrors.push(String(e).slice(0, 300)));
  return p;
}
