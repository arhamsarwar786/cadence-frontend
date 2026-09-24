import type { Page } from "@playwright/test";

/** Treat the user as signed out so guards and login flows behave consistently in E2E. */
export async function mockSignedOut(page: Page) {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (/\/api\/v1\/auth\/me\/?(\?|$)/.test(url)) {
        return new Response(
          JSON.stringify({ detail: "Authentication credentials were not provided." }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      return original(input, init);
    };
  });
}
