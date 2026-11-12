/**
 * Ad-hoc live check: adding a website asks for the domain ONLY — one field,
 * no name/description — and the created site's label is derived from it.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://router.tokendeal.cloud";
const PASSWORD = process.env.PASSWORD || "klkl";
const DOMAIN = process.env.DOMAIN || "field-check.example.com";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
      document.body.innerText.includes("Compiling") ||
      !!document.querySelector('[class*="shimmer"]')
  );
  if (!busy) break;
}
await page.waitForTimeout(2500);

// Open the inline add form on the Providers page.
await page.locator('button:has-text("Add website")').first().click();
await page.waitForTimeout(600);

const form = page.locator('[data-testid="add-site-form"]');
const fields = await form.evaluate((node) =>
  Array.from(node.querySelectorAll("input, textarea, select")).map((el) => ({
    tag: el.tagName.toLowerCase(),
    label: node
      .querySelector(`label:has([aria-label="${el.getAttribute("aria-label")}"])`)
      ?.textContent?.trim()
      .replace(/\s+/g, " "),
    ariaLabel: el.getAttribute("aria-label"),
    placeholder: el.getAttribute("placeholder"),
  }))
);

await page.screenshot({ path: "/tmp/opencode/add-website-form.png" });
const formBox = await form.boundingBox();
const barBox = await page
  .locator("select[aria-label='Website scope']")
  .boundingBox()
  .catch(() => null);
if (formBox) {
  await page.screenshot({
    path: "/tmp/opencode/add-website-form-crop.png",
    clip: {
      x: Math.max(0, formBox.x - 8),
      y: Math.max(0, (barBox?.y ?? formBox.y) - 8),
      width: 900,
      height: Math.round(formBox.y + formBox.height - (barBox?.y ?? formBox.y) + 20),
    },
  });
}

// Submit with the domain only.
await form.locator('input[aria-label="Website domain"]').fill(DOMAIN);
let postBody = null;
page.on("request", (req) => {
  if (req.method() === "POST" && req.url().includes("/api/sites")) postBody = req.postData();
});
await page.locator('[data-testid="add-site-form"] button:has-text("Add website")').click();
await page.waitForTimeout(4000);

const after = await page.evaluate(() => {
  const select = document.querySelector("select[aria-label='Website scope']");
  return {
    options: Array.from(select?.options ?? []).map((o) => o.textContent.trim()),
    selected: select?.value ?? null,
    url: location.search,
  };
});

console.log(JSON.stringify({ fields, postBody, after, errors: errors.slice(0, 5) }, null, 2));
await browser.close();
