#!/usr/bin/env node
/**
 * One-off probe of the provider DETAIL page (read-only).
 *
 * Dumps what the detail page actually renders (headings, sections, buttons,
 * table rows) for a few providers, so a rendered-vs-expected mismatch is
 * visible. Screenshots land in /tmp/opencode/ui-audit/.
 *
 * Usage: BASE_URL=... PASSWORD=... node scripts/ad-hoc/detail-probe.mjs [providerId ...]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:20128";
const PASSWORD = process.env.PASSWORD || "CHANGEME";
const OUT_DIR = process.env.OUT_DIR || "/tmp/opencode/ui-audit";
const PROVIDERS = process.argv.slice(2).length ? process.argv.slice(2) : ["openai", "groq"];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

  const out = [];
  for (const provider of PROVIDERS) {
    await page.goto(`${BASE_URL}/dashboard/providers/${provider}`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await page.waitForTimeout(9000);
    const info = await page.evaluate(() => {
      const main = document.querySelector("main");
      const text = (main?.innerText || "").replace(/\n{2,}/g, "\n").trim();
      return {
        path: location.pathname,
        text: text.slice(0, 2000),
        headings: Array.from(document.querySelectorAll("main h1, main h2, main h3")).map(
          (h) => `${h.tagName}: ${h.textContent.trim().slice(0, 50)}`
        ),
        buttons: Array.from(main?.querySelectorAll("button") || [])
          .map((b) =>
            (b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()
          )
          .filter(Boolean),
        tables: main?.querySelectorAll("table").length ?? 0,
        rows: main?.querySelectorAll("tbody tr").length ?? 0,
        sections: Array.from(main?.querySelectorAll("section, [data-testid]") || [])
          .map((s) => s.getAttribute("data-testid") || s.className.toString().slice(0, 50))
          .slice(0, 25),
      };
    });
    await page.screenshot({
      path: path.join(OUT_DIR, `detail-${provider}.png`),
      fullPage: false,
    });
    out.push({ provider, ...info });
  }

  fs.writeFileSync(path.join(OUT_DIR, "detail-probe.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1).slice(0, 6000));
  await browser.close();
}

main().catch((err) => {
  console.error("PROBE FAILED:", err);
  process.exit(1);
});
