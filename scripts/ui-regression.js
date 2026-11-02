import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Controlled API responses reproduce refresh races without touching any database.
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL === "chromium"
    ? {}
    : { channel: process.env.BROWSER_CHANNEL || "msedge" }),
});
const base = process.env.BASE_URL || "http://127.0.0.1:8095";
const failures = [];
await mkdir("output/previews", { recursive: true });

async function scenario(name, run) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = {
    user: null,
    pending: null,
    started: null,
    delay: false,
    fail: false,
    writes: 0,
  };
  state.issue = {
    id: 900001,
    title: "Refresh regression report",
    description: "Synthetic regression data only.",
    category: "IT & Network",
    location: "Test room",
    priority: "medium",
    status: "open",
    reporter_id: 10,
    reporter: "Test student",
    assignee_id: 20,
    assignee: "Test staff",
    created_at: new Date().toISOString(),
    due_at: new Date(Date.now() + 86400000).toISOString(),
    support_count: 0,
    supported: false,
  };
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const reply = (body, status = 200) => route.fulfill({ status, json: body });
    if (path === "/api/auth/me")
      return reply(
        state.user ? { user: state.user } : { error: "Please sign in." },
        state.user ? 200 : 401,
      );
    if (path === "/api/auth/login") {
      state.user = {
        id: 30,
        name: "Test admin",
        email: "admin@example.test",
        role: "admin",
      };
      return reply({ user: state.user });
    }
    if (path === "/api/staff")
      return reply([
        { id: 20, name: "Test staff" },
        { id: 21, name: "Replacement staff" },
      ]);
    if (path === "/api/issues") {
      if (state.delay) {
        state.started?.();
        await new Promise((resolve) => {
          state.pending = resolve;
        });
      }
      return state.fail
        ? reply({ error: "Simulated refresh failure." }, 503)
        : reply([{ ...state.issue }]);
    }
    if (path.endsWith("/attachments")) return reply([]);
    if (route.request().method() !== "GET") state.writes++;
    return reply({ error: "Unexpected mocked API request." }, 500);
  });
  async function login() {
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await page.getByLabel("Email address").fill("admin@example.test");
    await page.getByLabel("Password", { exact: true }).fill("MockPassword1234");
    await page
      .getByRole("button", { name: "Sign in as Admin", exact: true })
      .click();
    await page
      .getByText("Updating reports…", { exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: state.issue.title, exact: true })
      .waitFor();
  }
  async function openDuringRefresh() {
    state.delay = true;
    const started = new Promise((resolve) => {
      state.started = resolve;
    });
    await page
      .getByRole("button", { name: "Refresh issues", exact: true })
      .click();
    await started;
    await page
      .getByRole("button", { name: state.issue.title, exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
  }
  try {
    await page.goto(base);
    await page
      .getByRole("heading", { name: "Good to see you again.", exact: true })
      .waitFor();
    await run({ page, state, login, openDuringRefresh });
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL: ${name}: ${error.message}`);
  } finally {
    state.pending?.();
    await context.unrouteAll({ behavior: "wait" });
    await context.close();
  }
}

try {
  await scenario(
    "portals clearly separate roles and only students can register",
    async ({ page }) => {
      for (const portal of ["Student", "Staff", "Admin"]) {
        await page.getByRole("button", { name: portal, exact: true }).click();
        assert.equal(
          await page
            .getByRole("button", { name: portal, exact: true })
            .getAttribute("aria-pressed"),
          "true",
        );
        await page
          .getByRole("form", { name: `${portal} sign in`, exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "Create account", exact: true })
            .count(),
          portal === "Student" ? 1 : 0,
        );
        for (const width of [375, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
        }
      }
      await page.screenshot({
        path: "output/previews/role-login.png",
        fullPage: true,
      });
    },
  );
  await scenario(
    "production UI has no development or seeded-data claims",
    async ({ page, login }) => {
      assert.equal(await page.locator(".local-note").count(), 0);
      await login();
      assert.equal(
        await page.locator(".environment").innerText(),
        "Campus workspace",
      );
      assert.doesNotMatch(
        await page.locator(".page-footer").innerText(),
        /development|checkpoint/i,
      );
    },
  );
  await scenario(
    "open report follows delayed refresh and preserves notes",
    async ({ page, state, login, openDuringRefresh }) => {
      await login();
      await openDuringRefresh();
      const dialog = page.getByRole("dialog");
      await page
        .getByLabel("Resolution notes (required to resolve)")
        .fill("Keep these draft notes during refresh.");
      // Check the actual bug before the additional loading-state assertions.
      state.issue = {
        ...state.issue,
        status: "in_progress",
        assignee_id: 21,
        assignee: "Replacement staff",
      };
      state.pending();
      await page
        .getByText("Updating reports…", { exact: true })
        .waitFor({ state: "hidden" });
      await dialog
        .getByText("In progress", { exact: true })
        .waitFor({ timeout: 3000 });
      assert.equal(
        await page.getByLabel("Assign maintenance staff").inputValue(),
        "21",
      );
      assert.equal(
        await page
          .getByLabel("Resolution notes (required to resolve)")
          .inputValue(),
        "Keep these draft notes during refresh.",
      );
      await page.screenshot({
        path: "output/previews/refresh-regression-passed.png",
      });
    },
  );
  await scenario(
    "stale report actions stay disabled during a failed refresh",
    async ({ page, state, login, openDuringRefresh }) => {
      await login();
      await openDuringRefresh();
      assert.equal(
        await page
          .getByRole("button", { name: "Assign", exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Start work", exact: true })
          .isDisabled(),
        true,
      );
      state.fail = true;
      state.pending();
      await page
        .getByRole("dialog")
        .getByRole("alert")
        .filter({ hasText: "Simulated refresh failure." })
        .waitFor({ timeout: 3000 });
      assert.equal(
        await page
          .getByRole("button", { name: "Assign", exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(state.writes, 0);
      state.delay = false;
      state.fail = false;
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Retry report refresh", exact: true })
        .click();
      await page
        .getByText("Updating report details…", { exact: true })
        .waitFor({ state: "hidden" });
      await page.waitForFunction(
        () => !document.querySelector(".assign-row button").disabled,
      );
    },
  );
} finally {
  await browser.close();
}
assert.deepEqual(failures, [], "UI regression scenarios must all pass");
