import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { db } from "../server/src/db.js";
await mkdir("output/previews", { recursive: true });
const browserOptions = { headless: true };

if (process.env.BROWSER_CHANNEL !== "chromium") {
  browserOptions.channel = process.env.BROWSER_CHANNEL || "msedge";
}

const browser = await chromium.launch(browserOptions);
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";
const origin = new URL(baseUrl).origin;
const networkErrors = [];
page.on("response", (response) => {
  const url = new URL(response.url());
  // An initial anonymous session check is expected to return 401.
  if (url.origin === origin && response.status() >= 400 &&
      !(url.pathname === "/api/auth/me" && response.status() === 401)) {
    networkErrors.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
  }
});
page.on("requestfailed", (request) => {
  const url = new URL(request.url());
  if (url.origin === origin) networkErrors.push(`Network failure: ${url.pathname}`);
});
const unique = Date.now();
const email = `browser-${unique}@example.test`;
const title = `Browser checkpoint report ${unique}`;
const staffEmail = `browser-staff-${unique}@example.test`;
const password = process.env.SEED_PASSWORD;
async function signIn(email) {
  const portal = email === "admin@campusfix.local" ? "Admin"
    : email === "staff@campusfix.local" || email === staffEmail ? "Staff" : "Student";
  await page.getByRole("button", { name: portal, exact: true }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const loadedIssues = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/issues") &&
      response.request().method() === "GET",
  );
  await page.getByRole("button", { name: `Sign in as ${portal}`, exact: true }).click();
  assert.equal(
    (await loadedIssues).status(),
    200,
    "Dashboard data must load before capture",
  );
  await page
    .getByRole("heading", {
      name:
        email === "admin@campusfix.local"
          ? "Your campus. Under control."
          : email === "staff@campusfix.local" || email === staffEmail
            ? "Ready for your next fix?"
            : "A better campus starts here.",
    })
    .waitFor();
  await page.locator(".issues-panel").waitFor();
  await page
    .getByText("Updating reports…", { exact: true })
    .waitFor({ state: "hidden" });
}
async function signOut() {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Good to see you again." }).waitFor();
}
async function noOverflow() {
  await page
    .waitForFunction(
      () => document.documentElement.scrollWidth <= innerWidth,
      {},
      { timeout: 3000 },
    )
    .catch(async () => {
      console.log(
        await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          offenders: [...document.querySelectorAll("body *")]
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .map((e) => ({
              tag: e.tagName,
              cls: typeof e.className === "string" ? e.className : "svg",
              right: e.getBoundingClientRect().right,
            }))
            .slice(0, 20),
        })),
      );
      await page.screenshot({
        path: "output/previews/overflow-debug.png",
        fullPage: true,
      });
    });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "Layout must not overflow horizontally",
  );
}
try {
  await page.goto(baseUrl);
  await page.getByRole("heading", { name: "Good to see you again." }).waitFor();
  await page.screenshot({
    path: "output/previews/login-desktop.png",
    fullPage: true,
  });
  await signIn("student@campusfix.local");
  await page.locator(".recharts-surface").waitFor();
  await noOverflow();
  await page.screenshot({
    path: "output/previews/dashboard-desktop.png",
    fullPage: true,
  });
  for (const [width, height] of [
    [375, 812],
    [812, 375],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    await noOverflow();
    if (width === 375)
      await page.screenshot({
        path: "output/previews/dashboard-mobile.png",
        fullPage: true,
      });
  }
  await page
    .getByRole("button", {
      name: "View Wi-Fi disconnects during lab sessions",
      exact: true,
    })
    .click();
  const modal = page.getByRole("dialog");
  await modal.waitFor();
  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "hidden" });
  await signOut();
  await page.setViewportSize({ width: 375, height: 812 });
  await noOverflow();
  await page.screenshot({
    path: "output/previews/login-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Browser Checkpoint Student");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create student account" }).click();
  await page
    .getByRole("heading", { name: "A better campus starts here." })
    .waitFor();
  await page
    .getByRole("button", { name: "Report an issue", exact: true })
    .last()
    .click();
  await page.getByLabel(/What.s the issue\?/).fill(title);
  await page
    .getByLabel("Location", { exact: true })
    .fill("Browser test lab 101");
  await page
    .getByLabel("Describe the problem")
    .fill("The classroom projector needs a maintenance inspection.");
  await page.getByRole("button", { name: "Submit report" }).click();
  await page.getByRole("button", { name: title, exact: true }).waitFor();
  await signOut();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await signIn("admin@campusfix.local");
  await noOverflow();
  await page.screenshot({
    path: "output/previews/admin-dashboard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await noOverflow();
  await page.screenshot({
    path: "output/previews/admin-dashboard-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Manage staff", exact: true })
    .click();
  await page.getByLabel("Staff full name").fill("Browser Staff Member");
  await page.getByLabel("Staff email").fill(staffEmail);
  await page.getByLabel("Initial password").fill(password);
  await page
    .getByRole("button", { name: "Create staff account", exact: true })
    .click();
  await page
    .getByText(
      "Browser Staff Member now has a staff account and can be assigned reports.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole("heading", { name: "Browser Staff Member", exact: true })
    .waitFor();
  await page.screenshot({
    path: "output/previews/admin-team.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await noOverflow();
  await page.screenshot({
    path: "output/previews/admin-team-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page
    .getByRole("button", { name: "All issues", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: title, exact: true }).click();
  await page
    .getByLabel("Assign maintenance staff")
    .selectOption({ label: "Priya Mehta" });
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await signOut();
  await signIn("staff@campusfix.local");
  await page.screenshot({
    path: "output/previews/staff-dashboard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await noOverflow();
  await page.screenshot({
    path: "output/previews/staff-dashboard-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator(".work-stages button").first().click();
  await page
    .getByRole("button", { name: "Open", exact: true, pressed: true })
    .waitFor();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "My assignments", exact: true })
    .click();
  await page.getByRole("button", { name: title, exact: true }).click();
  await page.getByRole("button", { name: "Start work", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: title, exact: true }).click();
  await page
    .getByLabel("Resolution notes (required to resolve)")
    .fill("Inspected and replaced the faulty projector cable.");
  await page
    .getByRole("button", { name: "Mark resolved", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await signOut();
  await signIn(email);
  await page.getByRole("button", { name: title, exact: true }).click();
  await page.getByRole("button", { name: "Confirm fix", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await signOut();
  await signIn(staffEmail);
  assert.equal(
    await page
      .getByRole("button", { name: "Manage staff", exact: true })
      .count(),
    0,
  );
  const record = (
    await db.query("SELECT status FROM issues WHERE title=$1", [title])
  ).rows[0];
  assert.equal(record.status, "closed");
  assert.deepEqual(errors, [], "No browser runtime errors");
  assert.deepEqual(networkErrors, [], "No unexpected failed API or asset requests");
  console.log(
    "PASS: real browser registration, login, reporting, assignment, staff resolution, student confirmation, keyboard dialog dismissal, and responsive layouts (375/768/812/1440).",
  );
} finally {
  await browser.close();
  await db.query(
    "DELETE FROM supports WHERE issue_id IN (SELECT id FROM issues WHERE title=$1)",
    [title],
  );
  await db.query("DELETE FROM issues WHERE title=$1", [title]);
  await db.query("DELETE FROM users WHERE email=ANY($1)", [
    [email, staffEmail],
  ]);
  await db.end();
}
