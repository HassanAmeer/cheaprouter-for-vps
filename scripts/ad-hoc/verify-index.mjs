import { chromium } from "playwright";
const BASE = process.env.BASE_URL,
  PASSWORD = process.env.PASSWORD;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
const input = page.locator('input[type="password"]').first();
await input.waitFor({ state: "visible", timeout: 60000 });
await input.fill(PASSWORD);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
await page.goto(`${BASE}/dashboard/providers`, { waitUntil: "domcontentloaded", timeout: 300000 });
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(2000);
  const busy = await page.evaluate(() => document.body.innerText.includes("Compiling"));
  if (!busy) break;
}
await page.waitForTimeout(6000);
const index = await page.evaluate(() => ({
  rows: document.querySelectorAll('[data-testid="provider-section-index"] button').length,
  counts: Array.from(document.querySelectorAll('[data-testid="provider-section-index"] button'))
    .slice(0, 6)
    .map((b) => b.innerText.replace(/\n+/g, " | ").slice(0, 70)),
  typeSelect: document.querySelector("#provider-type-filter")?.value ?? null,
  typeOptions: document.querySelectorAll("#provider-type-filter option").length,
  chipRows: Array.from(document.querySelectorAll("button")).filter((b) =>
    /^(OAuth|IDE|CLI|Free Tier|API Key|No Auth|Web Cookie)\b/.test((b.innerText || "").trim())
  ).length,
}));
console.log("INDEX:", JSON.stringify(index, null, 1));
await page.screenshot({ path: "/tmp/opencode/ui-audit/v2-index.png" });
// open a section
const row = page
  .locator('[data-testid="provider-section-index"] button')
  .filter({ hasText: "API Key Providers" })
  .first();
if (await row.count()) {
  await row.click();
  await page.waitForTimeout(4000);
  const after = await page.evaluate(() => ({
    h2: Array.from(document.querySelectorAll("main h2"))
      .map((h) => h.innerText.replace(/\n/g, " ").slice(0, 40))
      .slice(0, 8),
    cards: document.querySelectorAll("main [data-testid], main a[href^='/dashboard/providers/']")
      .length,
    selectValue: document.querySelector("#provider-type-filter")?.value ?? null,
  }));
  console.log("AFTER CLICK:", JSON.stringify(after, null, 1));
  await page.screenshot({ path: "/tmp/opencode/ui-audit/v2-section.png" });
}
await browser.close();
