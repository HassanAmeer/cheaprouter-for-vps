#!/usr/bin/env node
/**
 * Render a local HTML file to a PNG screenshot (headless Chromium).
 * Usage: node scripts/ad-hoc/render-html.mjs <input.html> <output.png> [width] [height]
 */
import { chromium } from "playwright";
import path from "node:path";

const [input, output, width = "1440", height = "900"] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: render-html.mjs <input.html> <output.png> [width] [height]");
  process.exit(1);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 2,
});
await page.goto(`file://${path.resolve(input)}`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: output, fullPage: true });
console.log("rendered", output);
await browser.close();
