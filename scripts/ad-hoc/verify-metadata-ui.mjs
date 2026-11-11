import { chromium } from "playwright";
const BASE = process.env.BASE_URL,
  PASSWORD = process.env.PASSWORD;
const provider = process.argv[2] || "openai";
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
await page.waitForTimeout(30000);
const rows = await page.evaluate(() => {
  const trs = Array.from(document.querySelectorAll("tbody tr")).slice(0, 6);
  return trs.map((tr) => {
    const tds = Array.from(tr.querySelectorAll("td"));
    const ctx = tds[2];
    const caps = tds[3];
    return {
      model: (tr.querySelector("span.select-all")?.textContent || "").trim(),
      context: (ctx?.innerText || "").trim(),
      contextTitle: ctx?.querySelector("span")?.getAttribute("title") || "",
      caps: (caps?.innerText || "").replace(/\s+/g, " ").trim(),
      capsTitle: caps?.getAttribute("title") || "",
    };
  });
});
console.log(JSON.stringify(rows, null, 1));
await page.screenshot({ path: "/tmp/opencode/ui-audit/v5-metadata.png" });
await browser.close();
