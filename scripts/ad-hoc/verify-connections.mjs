import { chromium } from "playwright";
const BASE = process.env.BASE_URL,
  PASSWORD = process.env.PASSWORD;
const provider = process.argv[2] || "opencode-cli";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
const input = page.locator('input[type="password"]').first();
await input.waitFor({ state: "visible", timeout: 60000 });
await input.fill(PASSWORD);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
await page.goto(`${BASE}/dashboard/providers/${provider}`, {
  waitUntil: "domcontentloaded",
  timeout: 300000,
});
await page.waitForTimeout(28000);
const tabs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="tab"]')).map((t) =>
    t.innerText.replace(/\n+/g, " ").trim()
  )
);
console.log("TABS:", JSON.stringify(tabs));
const connTab = page.locator('button[role="tab"]', { hasText: "Connections" }).first();
if (await connTab.count()) {
  await connTab.click();
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => ({
    tabPanel: !!document.querySelector('[data-testid="connections-tab"]'),
    empty: !!document.querySelector('[data-testid="connections-empty-state"]'),
    rows: document.querySelectorAll('[data-testid="connections-tab"] > div > div').length,
    text: (document.querySelector('[data-testid="connections-tab"]')?.innerText || "").slice(
      0,
      400
    ),
  }));
  console.log("CONNECTIONS:", JSON.stringify(info, null, 1));
  await page.screenshot({ path: "/tmp/opencode/ui-audit/v4-connections.png" });
}
await browser.close();
