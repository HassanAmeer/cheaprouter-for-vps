import { chromium } from "playwright";
const BASE = process.env.BASE_URL,
  PASSWORD = process.env.PASSWORD;
const routes = (process.argv[2] || "/dashboard/providers").split(",");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
const input = page.locator('input[type="password"]').first();
await input.waitFor({ state: "visible", timeout: 60000 });
await input.fill(PASSWORD);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
for (const route of routes) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  // wait until the shimmer skeleton is gone
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(2000);
    const busy = await page.evaluate(
      () =>
        document.body.innerText.includes("Compiling") ||
        !!document.querySelector('[class*="shimmer"]')
    );
    if (!busy) break;
  }
  await page.waitForTimeout(2500);
  const name = route.replace(/\//g, "_");
  await page.screenshot({
    path: `/tmp/opencode/ui-audit/shot${name}-desktop.png`,
    fullPage: false,
  });
  await page.screenshot({ path: `/tmp/opencode/ui-audit/shot${name}-full.png`, fullPage: true });
  const sections = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main h2, main h3"))
      .map((h) => h.textContent.trim().slice(0, 46))
      .slice(0, 40)
  );
  console.log(route, "->", JSON.stringify(sections));
}
await browser.close();
