#!/usr/bin/env node
/**
 * One-off UI/UX audit of the live dashboard (read-only).
 *
 * Logs into the running CheapRoute instance, walks the main dashboard pages at
 * a desktop and a mobile viewport, and reports:
 *  - accessible-name gaps on icon-only controls,
 *  - duplicate landmarks / headings,
 *  - clickable non-interactive elements,
 *  - nested buttons,
 *  - inputs without a label,
 *  - horizontal overflow at 375px and the elements causing it,
 *  - console errors per page.
 *
 * Screenshots land in /tmp/opencode/ui-audit/<page>-<viewport>.png.
 *
 * Usage:
 *   BASE_URL=http://201.18.218.29:20128 PASSWORD=xxx node scripts/ad-hoc/ui-audit.mjs [page ...]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:20128";
const PASSWORD = process.env.PASSWORD || "CHANGEME";
const OUT_DIR = process.env.OUT_DIR || "/tmp/opencode/ui-audit";

const PAGES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "/home",
      "/dashboard/providers",
      "/dashboard/combos",
      "/dashboard/endpoint",
      "/dashboard/usage",
      "/dashboard/settings",
      "/dashboard/limits",
      "/dashboard/logs",
      "/dashboard/manage-models",
      "/dashboard/playground",
      "/dashboard/api-manager",
      "/dashboard/users",
    ];

const AUDIT = () => {
  const name = (el) => {
    const aria = el.getAttribute("aria-label");
    if (aria && aria.trim()) return aria.trim();
    const title = el.getAttribute("title");
    if (title && title.trim()) return title.trim();
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const target = document.getElementById(labelledby);
      if (target && target.textContent.trim()) return target.textContent.trim();
    }
    const text = (el.innerText || el.textContent || "").trim();
    return text.replace(/\s+/g, " ").slice(0, 40);
  };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      st.visibility !== "hidden" &&
      st.display !== "none" &&
      st.opacity !== "0"
    );
  };
  const all = Array.from(document.querySelectorAll("*"));

  const noName = all
    .filter((el) => ["BUTTON", "A"].includes(el.tagName) && vis(el))
    .filter((el) => {
      const n = name(el);
      if (n) return false;
      // Material-symbols ligature text is not a real accessible name.
      return true;
    })
    .slice(0, 25)
    .map((el) => ({
      tag: el.tagName,
      cls: (el.className || "").toString().slice(0, 60),
      html: el.outerHTML.slice(0, 160),
    }));

  const ligatureOnly = all
    .filter((el) => el.tagName === "BUTTON" && vis(el))
    .filter((el) => {
      const aria = el.getAttribute("aria-label");
      const title = el.getAttribute("title");
      if (aria && aria.trim()) return false;
      if (title && title.trim()) return false;
      const text = (el.innerText || "").trim();
      // a lone material-symbols ligature (e.g. "close", "settings") is not a name
      return /^[a-z_]{3,24}$/.test(text) && el.querySelector(".material-symbols-outlined");
    })
    .slice(0, 25)
    .map((el) => ({
      text: (el.innerText || "").trim(),
      html: el.outerHTML.slice(0, 160),
    }));

  const clickableNonInteractive = all
    .filter((el) => ["DIV", "SPAN", "LI", "TD", "TR", "SVG"].includes(el.tagName) && vis(el))
    .filter((el) => {
      if (el.closest("button, a[href], [role='button'], [role='link']")) return false;
      const reactKey = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
      const props = reactKey ? el[reactKey] : null;
      return Boolean(props && typeof props.onClick === "function");
    })
    .slice(0, 20)
    .map((el) => ({
      tag: el.tagName,
      role: el.getAttribute("role"),
      tabindex: el.getAttribute("tabindex"),
      html: el.outerHTML.slice(0, 140),
    }));

  // Buttons inside a form without type="button" submit the form by accident.
  const submitAccidents = all
    .filter((el) => el.tagName === "BUTTON" && el.closest("form"))
    .filter((el) => !el.getAttribute("type"))
    .slice(0, 15)
    .map((el) => el.outerHTML.slice(0, 140));

  // Focusable elements inside an aria-hidden container (keyboard trap / ghost focus).
  const focusableInAriaHidden = all
    .filter((el) => {
      if (!el.closest('[aria-hidden="true"]')) return false;
      return ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
    })
    .slice(0, 15)
    .map((el) => el.outerHTML.slice(0, 140));

  // Off-screen (translated) panels that are still focusable.
  const offscreenFocusable = all
    .filter((el) => {
      if (!["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return false;
      const r = el.getBoundingClientRect();
      const off = r.right < -5 || r.left > document.documentElement.clientWidth + 5;
      if (!off) return false;
      if (el.className && String(el.className).includes("sr-only")) return false;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return false;
      // `inert` subtrees are out of the tab order — off-screen is fine there.
      if (el.closest("[inert]")) return false;
      if (el.tabIndex < 0) return false;
      return true;
    })
    .slice(0, 15)
    .map((el) => ({
      tag: el.tagName,
      text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30),
      cls: (el.className || "").toString().slice(0, 60),
      parent: el.parentElement?.className?.toString().slice(0, 60),
    }));

  const duplicateIds = (() => {
    const seen = new Map();
    for (const el of all) {
      if (!el.id) continue;
      seen.set(el.id, (seen.get(el.id) || 0) + 1);
    }
    return Array.from(seen.entries())
      .filter(([, count]) => count > 1)
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));
  })();

  const nestedButtons = all
    .filter((el) => el.tagName === "BUTTON" && el.querySelector("button"))
    .slice(0, 10)
    .map((el) => el.outerHTML.slice(0, 200));

  const h1s = Array.from(document.querySelectorAll("h1")).map((h) =>
    h.textContent.trim().slice(0, 40)
  );
  const mains = document.querySelectorAll("main").length;
  const skips = Array.from(document.querySelectorAll('a[href^="#"]'))
    .filter((a) => /skip/i.test(a.textContent || ""))
    .map((a) => a.textContent.trim());

  const unlabeledInputs = Array.from(document.querySelectorAll("input, textarea, select"))
    .filter((el) => vis(el))
    .filter((el) => {
      if (el.getAttribute("aria-label")) return false;
      if (el.getAttribute("aria-labelledby")) return false;
      if (el.id && document.querySelector(`label[for="${el.id}"]`)) return false;
      if (el.closest("label")) return false;
      if (el.getAttribute("placeholder")) return false;
      return true;
    })
    .slice(0, 15)
    .map((el) => el.outerHTML.slice(0, 140));

  const imgsNoAlt = Array.from(document.querySelectorAll("img"))
    .filter((img) => !img.hasAttribute("alt"))
    .slice(0, 10)
    .map((img) => img.outerHTML.slice(0, 120));

  const vw = document.documentElement.clientWidth;
  const overflowers = Array.from(document.querySelectorAll("body *"))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > vw + 2;
    })
    .slice(0, 12)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        cls: (el.className || "").toString().slice(0, 70),
        right: Math.round(r.right),
        width: Math.round(r.width),
        text: (el.innerText || "").trim().slice(0, 40),
      };
    });

  return {
    path: location.pathname,
    title: document.title,
    viewport: { w: vw, h: document.documentElement.clientHeight },
    docScrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > vw + 2,
    h1s,
    mains,
    skips,
    noName,
    ligatureOnly,
    clickableNonInteractive,
    submitAccidents,
    focusableInAriaHidden,
    offscreenFocusable,
    duplicateIds,
    nestedButtons,
    unlabeledInputs,
    imgsNoAlt,
    overflowers,
  };
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 200)}`));

  // ── login ──
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const input = page.locator('input[type="password"]').first();
  await input.waitFor({ state: "visible", timeout: 60000 });
  for (let attempt = 0; attempt < 3; attempt++) {
    await input.fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    const landed = await page
      .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    if (landed) break;
    console.error(`login attempt ${attempt + 1} did not leave /login, retrying`);
    await page.waitForTimeout(1500);
  }
  console.error("logged in, current path:", new URL(page.url()).pathname);

  const report = [];
  for (const p of PAGES) {
    consoleErrors.length = 0;
    try {
      await page.goto(`${BASE_URL}${p}`, { waitUntil: "domcontentloaded", timeout: 180000 });
      await page.waitForTimeout(2500);
    } catch (err) {
      report.push({ page: p, error: String(err).slice(0, 200) });
      continue;
    }
    const desktop = await page.evaluate(AUDIT);
    await page.screenshot({
      path: path.join(OUT_DIR, `${p.replace(/\//g, "_")}-desktop.png`),
      fullPage: false,
    });

    await page.setViewportSize({ width: 375, height: 720 });
    await page.waitForTimeout(1200);
    const mobile = await page.evaluate(AUDIT);
    await page.screenshot({
      path: path.join(OUT_DIR, `${p.replace(/\//g, "_")}-mobile.png`),
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    report.push({
      page: p,
      desktop,
      mobile,
      consoleErrors: [...new Set(consoleErrors)].slice(0, 6),
    });
  }

  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1).slice(0, 20000));
  await browser.close();
}

main().catch((err) => {
  console.error("AUDIT FAILED:", err);
  process.exit(1);
});
