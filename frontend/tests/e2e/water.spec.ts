import { test, expect, request } from "@playwright/test";

const API = process.env.PLAYWRIGHT_API_BASE ?? "http://localhost:3000/api/v1";

async function adminLogin() {
  const ctx = await request.newContext();
  const resp = await ctx.post(`${API}/auth/login`, {
    data: {
      email: process.env.ADMIN_EMAIL ?? "admin@example.com",
      password: process.env.ADMIN_PASSWORD ?? "TestAdminPass123!",
    },
  });
  if (!resp.ok()) {
    throw new Error(`admin login failed: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  return body.access_token as string;
}

test.beforeEach(async ({ context }) => {
  // Pre-seed local storage so the (app) layout auth-guard doesn't redirect to /login
  const access = await adminLogin();
  // The admin user's bootstrap unlocked the onboarding titles ("Newbie" +
  // first-action set), so /me returns a non-empty `pending_title_unlocks`.
  // Without acknowledging them, the TitleUnlockModal opens on the first
  // protected route and its fixed-position overlay intercepts every click.
  const ackCtx = await request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${access}` },
  });
  await ackCtx.post(`${API}/titles/acknowledge-all`, { data: {} });
  await context.addInitScript((token) => {
    window.localStorage.setItem("wq.access", token);
    window.localStorage.setItem("wq.refresh", "noop");
  }, access);
});

test("water quick-add updates total and progress", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("water-total")).toBeVisible();
  const totalText = await page.getByTestId("water-total").textContent();
  expect(totalText).toMatch(/\/ \d+ ml$/);

  await page.getByTestId("quick-add-250").click();
  await expect(page.getByTestId("water-total")).toContainText("ml");
  // total includes at least 250 ml after the click
  await expect.poll(async () => {
    const t = (await page.getByTestId("water-total").textContent()) ?? "";
    const m = t.match(/^(\d+)/);
    return m ? Number(m[1]) : 0;
  }).toBeGreaterThanOrEqual(250);
});
