/**
 * Ad-hoc live check: the website picker sits in the sidebar nav, tight under
 * the Providers entry (not in the brand row), and opens its menu on click.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://router.tokendeal.cloud";
const PASSWORD = process.env.PASSWORD || "klkl";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));

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
await page.waitForTimeout(2000);

const visibleAside = page.locator("aside").filter({ visible: true }).first();
const aside = (await page.locator("aside").first().isVisible())
  ? page.locator("aside").first()
  : visibleAside;

const pickerOf = (root) => root.locator('[data-testid="sidebar-site-picker"]').first();

// The picker only renders in the expanded rail; expand if needed.
if (!(await pickerOf(aside).count())) {
  await aside.locator('button:has-text("chevron_right")').first().click().catch(() => {});
  await page.waitForTimeout(1500);
}

const picker = pickerOf(aside);
const pickerCount = await picker.count();

const geometry = await page.evaluate(() => {
  const asides = Array.from(document.querySelectorAll("aside"));
  const host = asides.find((a) => a.querySelector('[data-testid="sidebar-site-picker"]')) || asides[0];
  const navProviders = host?.querySelector('a[href="/dashboard/providers"]');
  const picker = host?.querySelector('[data-testid="sidebar-site-picker"]');
  const brand = host?.querySelector('a[href="/home"]');
  const btn = picker?.querySelector("button");
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const pr = r(navProviders);
  const kr = r(picker);
  const br = r(btn);
  const combos = host?.querySelector('a[href="/dashboard/combos"]');
  const cr = r(combos);
  return {
    providersLink: pr && { top: Math.round(pr.top), bottom: Math.round(pr.bottom) },
    pickerWrapper: kr && { top: Math.round(kr.top), bottom: Math.round(kr.bottom) },
    pickerButton: br && { top: Math.round(br.top), height: Math.round(br.height) },
    gapFromProvidersPx: pr && kr ? Math.round(kr.top - pr.bottom) : null,
    gapToNextItemPx: kr && cr ? Math.round(cr.top - kr.bottom) : null,
    pickerInsideBrandLink: !!(brand && picker && brand.contains(picker)),
    pickerText: btn?.textContent?.trim() ?? null,
  };
});

let menuVisible = false;
let menuItems = [];
if (pickerCount) {
  await picker.locator("button").first().click();
  await page.waitForTimeout(700);
  menuVisible = await page
    .locator('button:has-text("All sites (global)")')
    .first()
    .isVisible()
    .catch(() => false);
  menuItems = await page.evaluate(() => {
    const host = Array.from(document.querySelectorAll("aside")).find((a) =>
      a.querySelector('[data-testid="sidebar-site-picker"]')
    );
    const wrap = host?.querySelector('[data-testid="sidebar-site-picker"]');
    return Array.from(wrap?.querySelectorAll("button") ?? []).map((b) =>
      b.textContent.trim().replace(/\s+/g, " ").slice(0, 40)
    );
  });
  await page.screenshot({ path: "/tmp/opencode/sidebar-site-picker-menu.png" });
  // close the menu again for the clean crop
  await picker.locator("button").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
}

await page.screenshot({ path: "/tmp/opencode/sidebar-site-picker.png" });
const box = await aside.boundingBox();
if (box) {
  await page.screenshot({
    path: "/tmp/opencode/sidebar-site-picker-crop.png",
    clip: { x: box.x, y: Math.max(0, box.y), width: 520, height: 420 },
  });
}

console.log(
  JSON.stringify({ pickerCount, geometry, menuVisible, menuItems, errors: errors.slice(0, 6) }, null, 2)
);
await browser.close();
