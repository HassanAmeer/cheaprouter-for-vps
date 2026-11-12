/**
 * Ad-hoc live check: the providers page is back to the previous design —
 * category pills + stacked type sections rendered at once, no "Type" dropdown
 * and no compact index that has to be opened per row.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://router.tokendeal.cloud";
const PASSWORD = process.env.PASSWORD || "klkl";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 160));
});
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
const input = page.locator('input[type="password"]').first();
await input.waitFor({ state: "visible", timeout: 90000 });
await input.fill(PASSWORD);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60000 }).catch(() => {});

await page.goto(`${BASE}/dashboard/providers`, { waitUntil: "domcontentloaded", timeout: 300000 });
for (let i = 0; i < 45; i++) {
  await page.waitForTimeout(2000);
  const busy = await page.evaluate(
    () =>
      document.body.innerText.includes("Compiling") || !!document.querySelector('[class*="shimmer"]')
  );
  if (!busy) break;
}
await page.waitForTimeout(3000);

const report = await page.evaluate(() => {
  const main = document.querySelector("main") || document.body;
  const typeSelect = document.getElementById("provider-type-filter");
  const indexRows = Array.from(main.querySelectorAll("button")).filter(
    (b) => b.querySelector(".material-symbols-outlined") && /chevron|arrow_forward/.test(b.textContent)
  ).length;
  const headings = Array.from(main.querySelectorAll("h2")).map((h) =>
    h.textContent.trim().replace(/\s+/g, " ").slice(0, 46)
  );
  // The old design renders the pills as rounded-full buttons with a count.
  const pills = Array.from(main.querySelectorAll("button.rounded-full")).map((b) =>
    b.textContent.trim().replace(/\s+/g, " ").slice(0, 34)
  );
  return {
    hasTypeDropdown: !!typeSelect,
    headingCount: headings.length,
    headings: headings.slice(0, 24),
    pillCount: pills.length,
    pills: pills.slice(0, 18),
    indexRowCount: indexRows,
    hasSiteBar: !!Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Add site")
    ),
    providerCards: main.querySelectorAll('[data-testid="provider-card"], [class*="provider-card"]')
      .length,
  };
});

await page.screenshot({ path: "/tmp/opencode/providers-page-restored.png" });
await page.screenshot({
  path: "/tmp/opencode/providers-page-restored-top.png",
  clip: { x: 0, y: 0, width: 1440, height: 1000 },
});

console.log(JSON.stringify({ ...report, errors: errors.slice(0, 6) }, null, 2));
await browser.close();
