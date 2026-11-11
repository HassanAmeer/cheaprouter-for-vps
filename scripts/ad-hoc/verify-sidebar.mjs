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
await page.waitForTimeout(5000);
const groups = await page.evaluate(() => {
  const aside = document.querySelector("aside");
  if (!aside) return null;
  const out = [];
  let current = null;
  for (const node of aside.querySelectorAll("div, span, a")) {
    const text = (node.textContent || "").trim();
    if (!text || text.length > 40) continue;
    const cls = node.className?.toString() || "";
    if (cls.includes("uppercase") && cls.includes("tracking-wider") && node.children.length === 0) {
      current = text;
      out.push({ group: text, items: [] });
    } else if (current && node.tagName === "A" && node.querySelector("span")) {
      const label = node.innerText.split("\n")[0].trim();
      if (label && !out[out.length - 1].items.includes(label))
        out[out.length - 1].items.push(label);
    }
  }
  return out;
});
console.log(JSON.stringify(groups, null, 1));
await page.screenshot({ path: "/tmp/opencode/ui-audit/v3-sidebar.png" });
await browser.close();
