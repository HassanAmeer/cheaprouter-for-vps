/**
 * Ad-hoc live check: sidebar sections/tabs are expanded (uncollapsed) by
 * default on a fresh load — no section is collapsed unless the user saved a
 * non-empty expansion set.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://router.tokendeal.cloud";
const PASSWORD = process.env.PASSWORD || "klkl";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 160));
});

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
await page.waitForTimeout(2500);

const report = await page.evaluate(() => {
  const aside = document.querySelector("aside");
  // collapsed section headers show expand_more; expanded show expand_less
  const toggles = Array.from(aside.querySelectorAll("button")).filter((b) =>
    b.querySelector(".material-symbols-outlined")
  );
  const iconTexts = toggles.map((b) => b.textContent?.trim() ?? "");
  const expandMore = iconTexts.filter((t) => t === "expand_more").length;
  const expandLess = iconTexts.filter((t) => t === "expand_less").length;
  // child links visible (sections expanded reveal them)
  const navLinks = Array.from(aside.querySelectorAll("a[href]")).map((a) => a.textContent.trim().slice(0, 30));
  return {
    expandMoreCount: expandMore,
    expandLessCount: expandLess,
    totalSectionToggles: expandMore + expandLess,
    visibleNavLinks: navLinks.length,
    sampleLinks: navLinks.slice(0, 12),
    localStorage: localStorage.getItem("sidebar-expanded-sections"),
  };
});

await page.screenshot({ path: "/tmp/opencode/sidebar-expanded-default.png" });
await page.screenshot({
  path: "/tmp/opencode/sidebar-expanded-default-crop.png",
  clip: { x: 0, y: 0, width: 320, height: 900 },
});

console.log(JSON.stringify({ ...report, errors: errors.slice(0, 5) }, null, 2));
await browser.close();
