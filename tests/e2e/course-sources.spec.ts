import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";
import { courseSourcesFor } from "../../app/models/course-field-sources";

test.setTimeout(180_000);

test("updates derived courses while typing, preserves overrides, and remembers sources after reopening", async ({ page }) => {
  await page.route(/^https:\/\/(?:tile\.openstreetmap\.org|tiles\.openseamap\.org)\//, route => route.fulfill({ status: 204 }));
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    const lookups: Array<(declination: number) => void> = [];
    (window as unknown as { courseLookups: typeof lookups }).courseLookups = lookups;
    window.fetch = (input, init) => {
      if (String(input).startsWith("https://www.ngdc.noaa.gov/")) return new Promise<Response>(resolve => {
        lookups.push(declination => resolve(new Response(JSON.stringify({ result: [{ declination }] }), { headers: { "content-type": "application/json" } })));
      });
      return original(input, init);
    };
  });
  await loginWithSeededDemoData(page);
  await page.goto(`/details/${sampleLogSheets[0].id}`);
  const row = page.locator(".log-lines-table tbody tr").first();
  await row.getByRole("button", { name: "✏️" }).click();
  const show = page.getByRole("button", { name: "Show course conversion columns", exact: true });
  if (await show.count()) await show.click();
  const compass = row.locator(".course-number-input").nth(0);
  const magnetic = row.locator(".course-number-input").nth(2);
  for (const value of ["1", "12", "123"]) {
    await compass.fill(value);
    await expect(magnetic).toHaveValue(String(Number(value) + 2));
  }
  await magnetic.fill("200");
  await compass.fill("124");
  await expect(magnetic).toHaveValue("200");
  await magnetic.fill("");
  await expect(magnetic).toHaveValue("126");
  await row.getByRole("button", { name: "💾" }).click();
  await expect(row.locator("input")).toHaveCount(0);
  await expect.poll(async () => {
    const book = await (await page.request.get("/api/logbook")).json();
    return book.sheets.find((sheet: { id: string }) => sheet.id === sampleLogSheets[0].id).lines[0].courseFieldSources;
  }).toMatchObject({ compassCourse: "input", deviation: "calculated", magneticCourse: "calculated" });
  await page.reload();
  await row.getByRole("button", { name: "✏️" }).click();
  const showAgain = page.getByRole("button", { name: "Show course conversion columns", exact: true });
  if (await showAgain.count()) await showAgain.click();
  await row.locator(".course-number-input").nth(0).fill("125");
  await expect(row.locator(".course-number-input").nth(2)).toHaveValue("127");
  const variation = row.locator(".course-number-input").nth(3);
  await variation.fill("");
  await expect.poll(() => page.evaluate(() => (window as unknown as { courseLookups: unknown[] }).courseLookups.length)).toBe(1);
  await row.locator(".course-number-input").nth(0).fill("130");
  await expect.poll(() => page.evaluate(() => (window as unknown as { courseLookups: unknown[] }).courseLookups.length)).toBe(2);
  await page.evaluate(() => (window as unknown as { courseLookups: Array<(value: number) => void> }).courseLookups[1](4));
  await expect(variation).toHaveValue("4");
  await page.evaluate(async () => {
    (window as unknown as { courseLookups: Array<(value: number) => void> }).courseLookups[0](9);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  await expect(row.locator(".course-number-input").nth(4)).toHaveValue("136");
  await expect(variation).toHaveValue("4");
  await variation.fill("2");
  await row.locator(".course-number-input").nth(0).fill("131");
  await expect(variation).toHaveValue("2");

});

async function loginWithSeededDemoData(page: Page) {
  await page.goto("/login");
  const demoLogin = page.getByRole("button", { name: "Try the demo" });
  await expect(demoLogin).toBeVisible();
  await expect(demoLogin).toBeEnabled();
  await demoLogin.click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await removeDemoLogsheets(page);
  const seedResponse = await page.request.put("/api/logbook/import", { headers: { Origin: "http://127.0.0.1:3000", "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook" },
    data: { boats: sampleBoats.map((boat, index) => index === 0 ? { ...boat, deviationTable: [{ heading: 0, deviation: "2" }] } : boat), crewMembers: crewProfilesFromSheets(sampleLogSheets), sheets: sampleLogSheets.map((sheet, index) => index === 0 ? { ...sheet, lines: sheet.lines.map((line, row) => row === 0 ? { ...line, courseFieldSources: { ...courseSourcesFor({}), compassCourse: "input", variation: "input", windDrift: "input", currentDrift: "input" } } : line) } : sheet) },
  });
  expect(seedResponse.ok(), await seedResponse.text()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
}

async function removeDemoLogsheets(page: Page) {
  const currentResponse = await page.request.get("/api/logbook");
  expect(currentResponse.ok()).toBeTruthy();
  const currentLogbook = await currentResponse.json();
  // Clear sheets in one write so queued client normalization cannot restore a
  // reference between individual deletes and replacement demo seeding.
  const clearResponse = await page.request.put("/api/logbook/import", { headers: { Origin: "http://127.0.0.1:3000", "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook" }, data: { ...currentLogbook, sheets: [] } });
  expect(clearResponse.ok(), await clearResponse.text()).toBeTruthy();
  await expect.poll(async () => (await (await page.request.get("/api/logbook")).json()).sheets.length).toBe(0);
}

function crewProfilesFromSheets(sheets: typeof sampleLogSheets) {
  return sheets.flatMap((sheet) => sheet.crew).filter((crew, index, crews) => crews.findIndex((candidate) => candidate.id === crew.id) === index).map(({ embarkationDateTime, embarkationPosition, disembarkationDateTime, disembarkationPosition, ...crew }) => crew);
}
