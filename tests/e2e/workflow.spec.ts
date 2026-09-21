import { test, expect } from "@playwright/test";
import fs from "node:fs";
const example = JSON.parse(
  fs.readFileSync("public/examples/pendulum-45.json", "utf8"),
);
test("real demo: video, model switch, scrub, calibration, worker refit, export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.locator("#parameters")).toContainText("18.732");
  await expect(page.locator(".model-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Play experiment", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      (document.querySelector("video") as HTMLVideoElement).currentTime > 0.5,
  );
  await page
    .getByRole("button", { name: "Pause experiment", exact: true })
    .click();
  await page.locator("[data-model=linear]").click();
  await expect(page.locator("#parameters")).toContainText("17.614");
  await page.locator("[data-model=damped]").click();
  await page.locator("#scrub").fill("8");
  await page.locator("#scrub").dispatchEvent("input");
  await expect(page.locator("#time")).toContainText("8.00");
  await page.getByText("Add a physical calibration", { exact: false }).click();
  await page.locator("#cal-kind").selectOption("length");
  await page.locator("#cal-value").fill("0.5");
  await page.locator("#cal-error").fill("0.005");
  await expect(page.locator("#cal-result")).toContainText("9.366");
  await page.locator("#refit").click();
  await expect(page.locator("#status")).toBeHidden({ timeout: 60000 });
  await expect(page.locator("#parameters")).toContainText("18.732");
  const download = page.waitForEvent("download");
  await page.locator("#export").click();
  const file = await download;
  const path = await file.path();
  const result = JSON.parse(fs.readFileSync(path!, "utf8"));
  expect(result.points.length).toBe(420);
  expect(result.analysis.fits.length).toBe(3);
  await page.locator('[data-example="20"]').click();
  await expect(page.locator("#parameters")).toContainText("18.822");
  await expect(page.locator("#video-title")).toHaveText("Gentle release");
  expect(errors).toEqual([]);
});
test("upload actual footage, mark pivot and bob, track pixels, fit and correct a measurement", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("#parameters")).toContainText("18.732");
  await page.locator("#file").setInputFiles("public/examples/pendulum-45.mp4");
  await expect(page.locator("#setup")).toBeVisible();
  await page.locator("#end").fill("8");
  await page.locator("#select-pivot").click();
  let box = await page.locator("#overlay").boundingBox();
  await page.locator("#overlay").click({
    position: {
      x: (example.pivot.x / 960) * box!.width,
      y: (example.pivot.y / 540) * box!.height,
    },
  });
  await page.locator("#select-bob").click();
  box = await page.locator("#overlay").boundingBox();
  await page.locator("#overlay").click({
    position: {
      x: (example.points[0].x / 960) * box!.width,
      y: (example.points[0].y / 540) * box!.height,
    },
  });
  await page.locator("#track").click();
  await expect(page.locator("#status")).toBeHidden({ timeout: 100000 });
  await expect(page.locator("#parameters")).toContainText("q = g/L");
  await expect(page.locator(".model-card")).toHaveCount(3);
  const download = page.waitForEvent("download");
  await page.locator("#export").click();
  const file = await download;
  const result = JSON.parse(fs.readFileSync((await file.path())!, "utf8"));
  fs.writeFileSync("test-results/upload-result.json", JSON.stringify(result));
  expect(result.points.length).toBeGreaterThan(200);
  const rms = Math.sqrt(
    result.points.reduce(
      (sum: number, p: { t: number; x: number; y: number }) => {
        const ref = example.points[Math.round(p.t * 30)];
        return sum + (p.x - ref.x) ** 2 + (p.y - ref.y) ** 2;
      },
      0,
    ) / result.points.length,
  );
  expect(rms).toBeLessThan(3);
  const fitted = result.analysis.fits.find(
    (f: { model: string }) => f.model === "damped",
  );
  expect(fitted.params.q).toBeGreaterThan(18);
  expect(fitted.params.q).toBeLessThan(20);
  expect((fitted.testRmse * 180) / Math.PI).toBeLessThan(2);
  await page.locator("#scrub").fill("10");
  await page.locator("#scrub").dispatchEvent("input");
  await expect(page.locator("#stage-label")).toHaveText(
    "OUTSIDE ANALYZED INTERVAL",
  );
  await page.locator("#scrub").fill("0");
  await page.locator("#scrub").dispatchEvent("input");
  await page.locator("#correct").click();
  box = await page.locator("#overlay").boundingBox();
  await page.locator("#overlay").click({
    position: {
      x: (example.points[0].x / 960) * box!.width,
      y: (example.points[0].y / 540) * box!.height,
    },
  });
  await expect(page.locator("#model-cards")).toContainText(
    "Measurement corrected",
  );
  await page.locator("#refit").click();
  await expect(page.locator("#status")).toBeHidden({ timeout: 60000 });
});
test("mobile renders without horizontal overflow and can change experiments", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(page.locator("#parameters")).toContainText("18.732");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.locator('[data-example="20"]').click();
  await expect(page.locator("#video-title")).toHaveText("Gentle release");
  await page.screenshot({ path: "docs/mobile.png", fullPage: true });
});
