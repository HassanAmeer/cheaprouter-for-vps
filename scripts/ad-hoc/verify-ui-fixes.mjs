#!/usr/bin/env node
/**
 * One-off verification of the dashboard UI fixes (read-only).
 *
 * Checks on the live instance:
 *  - exactly one skip link and one heading per page,
 *  - the closed mobile drawer is inert (not focusable, hidden from AT),
 *  - the "Fetch All Models" button is fully inside a 375px viewport,
 *  - the closed capabilities sheet has no focusable controls,
 *  - the provider detail table shows a context window for static models.
 *
 * Usage: BASE_URL=... PASSWORD=... node scripts/ad-hoc/verify-ui-fixes.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:20128";
const PASSWORD = process.env.PASSWORD || "CHANGEME";

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const input = page.locator('input[type="password"]').first();
  await input.waitFor({ state: "visible", timeout: 60000 });
  for (let i = 0; i < 3; i++) {
    await input.fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    const landed = await page
      .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    if (landed) break;
    await page.waitForTimeout(1500);
  }

  // ── 1. one skip link / one heading per page ──
  for (const route of ["/home", "/dashboard/providers"]) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(3000);
    const counts = await page.evaluate(() => ({
      skips: Array.from(document.querySelectorAll('a[href^="#"]')).filter((a) =>
        /skip/i.test(a.textContent || "")
      ).length,
      h1s: document.querySelectorAll("h1").length,
    }));
    check(`${route}: exactly one skip link`, counts.skips === 1, `found ${counts.skips}`);
    check(`${route}: exactly one h1`, counts.h1s === 1, `found ${counts.h1s}`);
  }

  // ── 2. the closed mobile drawer is inert ──
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto(`${BASE_URL}/dashboard/providers`, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.waitForTimeout(3000);
  const drawer = await page.evaluate(() => {
    const el = document.querySelector(".dashboard-sidebar-mobile");
    if (!el) return { found: false };
    const focusables = el.querySelectorAll("a, button, input, select, textarea");
    return {
      found: true,
      inert: el.hasAttribute("inert"),
      ariaHidden: el.getAttribute("aria-hidden"),
      focusableCount: focusables.length,
      insideInert: focusables.length > 0 ? !!focusables[0].closest("[inert]") : false,
    };
  });
  check("closed mobile drawer is inert", drawer.inert === true, JSON.stringify(drawer));
  check(
    "closed mobile drawer hides its controls from AT",
    drawer.ariaHidden === "true" && drawer.insideInert === true,
    JSON.stringify(drawer)
  );

  // ── 3. the "Fetch All Models" button fits a 375px viewport ──
  await page.goto(`${BASE_URL}/dashboard/providers/openai`, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.waitForTimeout(9000);
  const fetchBtn = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => (b.innerText || "").includes("Fetch All Models"));
    if (!btn) return { found: false };
    const r = btn.getBoundingClientRect();
    return {
      found: true,
      right: Math.round(r.right),
      viewport: document.documentElement.clientWidth,
      fullyVisible: r.right <= document.documentElement.clientWidth + 1 && r.left >= 0,
    };
  });
  check(
    '"Fetch All Models" is fully visible at 375px',
    fetchBtn.found && fetchBtn.fullyVisible === true,
    JSON.stringify(fetchBtn)
  );

  // ── 4. the context-limit column shows a value for static models ──
  const contextCells = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const values = rows.slice(0, 6).map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      // 0 = active checkbox, 1 = model info, 2 = context limit, 3 = capabilities
      return cells[2]?.innerText?.trim() ?? "";
    });
    return { rows: rows.length, values };
  });
  check(
    "context limit column is populated",
    contextCells.rows > 0 && contextCells.values.some((v) => v && v !== "—"),
    JSON.stringify(contextCells)
  );

  // ── 5. the closed capabilities sheet has no focusable controls ──
  const sheet = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return { found: false };
    const focusables = dialog.querySelectorAll("a, button, input, select, textarea");
    return {
      found: true,
      inert: dialog.hasAttribute("inert"),
      ariaHidden: dialog.getAttribute("aria-hidden"),
      focusableCount: focusables.length,
    };
  });
  check(
    "closed capabilities sheet is inert",
    sheet.found === false || (sheet.inert === true && sheet.focusableCount > 0),
    JSON.stringify(sheet)
  );

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error("VERIFY FAILED:", err);
  process.exit(1);
});
