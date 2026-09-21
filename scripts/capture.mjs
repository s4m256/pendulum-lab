import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1350 },
  deviceScaleFactor: 1,
});
await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173/");
await page.locator("#parameters").filter({ hasText: "18.732" }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.locator("#scrub").fill("0.8");
await page.locator("#scrub").dispatchEvent("input");
await page.waitForFunction(
  () => Math.abs(document.querySelector("video").currentTime - 0.8) < 0.01,
);
await page.waitForTimeout(250);
await page.screenshot({ path: "docs/screenshot.png", fullPage: false });
await browser.close();
