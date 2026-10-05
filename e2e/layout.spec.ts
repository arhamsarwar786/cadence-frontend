import { test, expect, type Page } from "@playwright/test";
import { apiLogin, DEMO } from "./helpers/auth";

/**
 * Layout + responsiveness: at phone, tablet and desktop widths every screen must
 * have no horizontal page scroll, a header flush with the top, a back arrow on
 * sub pages only, and list tables whose header row stays put while rows scroll.
 */
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const STAFF_TOP = [
  "/jobs", "/shifts", "/hour-sheets", "/invoices", "/credit-notes", "/payroll", "/workers", "/clients",
  "/perm-placements", "/documents", "/esign", "/candidate-imports", "/privacy", "/privacy/breaches",
  "/privacy/disposal", "/reports", "/audit", "/settings", "/admin/users", "/notifications/templates",
];
const STAFF_SUB = ["/jobs/new", "/workers/new", "/clients/new", "/invoices/new"];
const DETAIL: Array<[string, string]> = [
  ["/jobs/", "/api/v1/jobs/"], ["/workers/", "/api/v1/workers/"], ["/clients/", "/api/v1/clients/"],
  ["/invoices/", "/api/v1/invoices/"], ["/hour-sheets/", "/api/v1/hour-sheets/"],
  ["/payroll/runs/", "/api/v1/payroll/runs/"], ["/privacy/breaches/", "/api/v1/privacy/breaches/"],
];
const LIST_TABLES = ["/workers", "/clients", "/jobs", "/invoices", "/audit"];
const PORTAL_TOP = ["/portal/offers", "/portal/pay-statements", "/portal/me", "/portal/documents", "/portal/shifts"];
const PORTAL_SUB = ["/portal/me/contact", "/portal/me/skills", "/portal/me/certs", "/portal/consent"];

async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
}

/** Problems with the current screen, as readable strings. */
async function inspect(page: Page, expectBack: boolean, staffHeader: boolean): Promise<string[]> {
  return page.evaluate(
    ({ expectBack, staffHeader }) => {
      const out: string[] = [];
      const doc = document.documentElement;
      if (doc.scrollWidth > doc.clientWidth + 1) out.push(`horizontal page scroll (${doc.scrollWidth} > ${doc.clientWidth})`);
      const main = document.getElementById("main-content");
      if (main && main.scrollWidth > main.clientWidth + 1) out.push(`main overflows sideways (${main.scrollWidth} > ${main.clientWidth})`);
      const h1 = document.querySelector("h1");
      if (!h1) out.push("no h1");
      const header = h1?.closest("header");
      if (staffHeader && header) {
        const top = header.getBoundingClientRect().top;
        if (Math.abs(top) > 1) out.push(`header not flush with top (top=${Math.round(top)}px)`);
        const r = header.getBoundingClientRect();
        for (const el of Array.from(header.querySelectorAll<HTMLElement>("button, a"))) {
          const b = el.getBoundingClientRect();
          if (b.width && (b.top < r.top - 1 || b.bottom > r.bottom + 1)) out.push(`header control clipped: "${el.innerText.trim()}"`);
        }
      }
      const back = document.querySelector('button[aria-label="Back"]');
      if (expectBack && !back) out.push("missing back arrow");
      if (!expectBack && back) out.push("unexpected back arrow on top-level screen");
      return out;
    },
    { expectBack, staffHeader },
  );
}

async function detailPaths(page: Page): Promise<string[]> {
  const paths: string[] = [];
  for (const [route, api] of DETAIL) {
    const res = await page.request.get(`${api}?page_size=1`);
    if (!res.ok()) continue;
    const j = await res.json();
    const id = (Array.isArray(j) ? j : j.results)?.[0]?.id;
    if (id) paths.push(`${route}${id}`);
  }
  return paths;
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("staff screens: no sideways scroll, flush header, back arrow on sub pages", async ({ page }) => {
      test.setTimeout(300_000);
      await apiLogin(page, DEMO.root);
      const found: string[] = [];
      const sub = [...STAFF_SUB, ...(await detailPaths(page))];
      for (const [path, back] of [...STAFF_TOP.map((p) => [p, false] as const), ...sub.map((p) => [p, true] as const)]) {
        await open(page, path);
        const issues = await inspect(page, back, true);
        if (issues.length) found.push(`${path}: ${issues.join("; ")}`);
      }
      console.log(`\n=== ${vp.name} staff layout (${found.length}) ===\n${found.join("\n") || "none"}`);
      expect.soft(found, found.join("\n")).toEqual([]);
    });

    test("worker portal screens: no sideways scroll, back arrow on sub pages", async ({ page }) => {
      test.setTimeout(180_000);
      await apiLogin(page, DEMO.worker);
      const found: string[] = [];
      for (const [path, back] of [...PORTAL_TOP.map((p) => [p, false] as const), ...PORTAL_SUB.map((p) => [p, true] as const)]) {
        await open(page, path);
        const issues = await inspect(page, back, false);
        if (issues.length) found.push(`${path}: ${issues.join("; ")}`);
      }
      console.log(`\n=== ${vp.name} portal layout (${found.length}) ===\n${found.join("\n") || "none"}`);
      expect.soft(found, found.join("\n")).toEqual([]);
    });

    test("list tables: header row and card stay fixed while rows scroll", async ({ page }) => {
      test.setTimeout(120_000);
      await apiLogin(page, DEMO.root);
      const found: string[] = [];
      for (const path of LIST_TABLES) {
        await open(page, path);
        const result = await page.evaluate(() => {
          const thead = document.querySelector("table thead");
          const scroller = thead?.closest("table")?.parentElement;
          const card = scroller?.parentElement;
          if (!thead || !scroller || !card) return "no table";
          if (scroller.scrollHeight <= scroller.clientHeight) return "fits"; // too few rows to scroll
          const cardTop = card.getBoundingClientRect().top;
          const headTop = thead.getBoundingClientRect().top;
          scroller.scrollTop = 400;
          const moved = Math.abs(card.getBoundingClientRect().top - cardTop);
          const headMoved = Math.abs(thead.getBoundingClientRect().top - headTop);
          if (scroller.scrollTop === 0) return "rows did not scroll";
          if (moved > 1) return `card moved ${Math.round(moved)}px`;
          if (headMoved > 1) return `header row moved ${Math.round(headMoved)}px`;
          return "ok";
        });
        if (result !== "ok" && result !== "fits") found.push(`${path}: ${result}`);
      }
      console.log(`\n=== ${vp.name} table scrolling (${found.length}) ===\n${found.join("\n") || "none"}`);
      expect.soft(found, found.join("\n")).toEqual([]);
    });
  });
}
