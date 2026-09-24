import { test, expect } from "@playwright/test";
import { mockSignedOut } from "./helpers/mock-session";

test.describe("Public login", () => {
  test.beforeEach(async ({ page }) => {
    await mockSignedOut(page);
  });

  test("login choice page shows agency and candidate options", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "How would you like to sign in?" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Agency Login/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Candidate Login/i })).toBeVisible();
  });

  test("agency login step 1 lists demo agency and advances to credentials", async ({ page }) => {
    await page.goto("/login/agency");

    await expect(page.getByRole("heading", { name: "Find your agency" })).toBeVisible();
    await page.getByRole("button", { name: /Cadence Demo/i }).click();

    await expect(page.getByRole("heading", { name: "Good to see you again." })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("candidate login page renders agency picker", async ({ page }) => {
    await page.goto("/login/candidate");

    await expect(page.getByRole("heading", { name: "Find your agency" })).toBeVisible();
  });
});

test.describe("Staff route guard", () => {
  test.beforeEach(async ({ page }) => {
    await mockSignedOut(page);
  });

  test("unauthenticated visit to staff home redirects to login", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "How would you like to sign in?" })).toBeVisible();
  });
});
