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
      if (String(input).startsWith("/api/navigation/magnetic-variation?")) return new Promise<Response>(resolve => {
        lookups.push(declination => resolve(new Response(JSON.stringify({ variation: declination }), { headers: { "content-type": "application/json" } })));
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
  await magnetic.fill("");
  await expect(magnetic).toBeFocused();
  await expect(magnetic).toHaveValue("");
  await magnetic.pressSequentially("200");
  await compass.fill("124");
  await expect(magnetic).toHaveValue("200");
  await magnetic.fill("");
  await expect(magnetic).toHaveValue("");
  await magnetic.blur();
  await expect(magnetic).toHaveValue("126");
  const savedResponse = page.waitForResponse(response => response.request().method() === "PUT" && response.url().endsWith(`/lines/${sampleLogSheets[0].lines[0].id}`), { timeout: 30_000 });
  await row.getByRole("button", { name: "💾" }).click();
  const saved = await savedResponse;
  expect(saved.ok(), `Save failed: HTTP ${saved.status()} ${await saved.text()}`).toBeTruthy();
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
  await row.getByRole("textbox", { name: "Lat", exact: true }).fill("39");
  await row.locator(".course-number-input").nth(0).fill("130");
  await expect.poll(() => page.evaluate(() => (window as unknown as { courseLookups: unknown[] }).courseLookups.length)).toBeGreaterThanOrEqual(2);
  await variation.focus();
  await page.evaluate(() => (window as unknown as { courseLookups: Array<(value: number) => void> }).courseLookups.at(-1)!(4));
  await expect(row.locator(".course-number-input").nth(4)).toHaveValue("136");
  await expect(variation).toHaveValue("");
  await variation.blur();
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
  await variation.fill("");
  await expect(row.locator(".course-number-input").nth(4)).toHaveValue("137");
  await expect(variation).toBeFocused();
  await expect(variation).toHaveValue("");
  await variation.blur();
  await expect(variation).toHaveValue("4");

});

test("restores automatic courses after clearing a migrated line and updates every digit on a new line", async ({ page }) => {
  await page.route("**/api/navigation/magnetic-variation?**", route => route.fulfill({ json: { variation: 4 } }));
  // Import without provenance to exercise the same conservative classification
  // as the database migration: every populated legacy value starts protected.
  await loginWithSeededDemoData(page, true);
  await page.goto(`/details/${sampleLogSheets[0].id}`);
  const row = page.locator(".log-lines-table tbody tr").first();
  await row.getByRole("button", { name: "✏️" }).click();
  const show = page.getByRole("button", { name: "Show course conversion columns", exact: true });
  if (await show.count()) await show.click();
  for (let index = 0; index < 9; index += 1) await row.locator(".course-number-input").nth(index).fill("");
  for (const value of ["1", "12", "123"]) {
    await row.locator(".course-number-input").nth(0).fill(value);
    await expect(row.locator(".course-number-input").nth(1)).toHaveValue("2");
    await expect(row.locator(".course-number-input").nth(2)).toHaveValue(String(Number(value) + 2));
    await expect(row.locator(".course-number-input").nth(3)).toHaveValue("4");
    await expect(row.locator(".course-number-input").nth(4)).toHaveValue(String(Number(value) + 6));
  }
  await row.getByRole("button", { name: "💾" }).click();
  await expect(row.locator(".course-number-input")).toHaveCount(0);
  await page.getByRole("button", { name: "+ Add line", exact: true }).click();
  const editor = page.locator(".inline-line-row").last();
  await editor.getByRole("textbox", { name: "Lat", exact: true }).fill("38.5");
  await editor.getByRole("textbox", { name: "Lon", exact: true }).fill("20.5");
  await expect(editor.locator(".course-number-input").nth(3)).toHaveValue("4");
  for (const value of ["1", "12", "123"]) {
    await editor.locator(".course-number-input").nth(0).fill(value);
    await expect(editor.locator(".course-number-input").nth(1)).toHaveValue("2");
    await expect(editor.locator(".course-number-input").nth(2)).toHaveValue(String(Number(value) + 2));
    await expect(editor.locator(".course-number-input").nth(3)).toHaveValue("4");
    await expect(editor.locator(".course-number-input").nth(4)).toHaveValue(String(Number(value) + 6));
  }
});

test("reports failed variation lookups and still accepts a protected manual value", async ({ page }) => {
  await page.route("**/api/navigation/magnetic-variation?**", route => route.fulfill({ status: 503, json: { error: "Magnetic variation provider is not configured." } }));
  await loginWithSeededDemoData(page);
  await page.goto(`/details/${sampleLogSheets[0].id}`);
  const row = page.locator(".log-lines-table tbody tr").first();
  await row.getByRole("button", { name: "✏️" }).click();
  const show = page.getByRole("button", { name: "Show course conversion columns", exact: true });
  if (await show.count()) await show.click();
  const variation = row.locator(".course-number-input").nth(3);
  await variation.fill("");
  await variation.blur();
  await expect(row.getByText("Magnetic variation could not be retrieved. Enter it manually or retry later.")).toBeVisible();
  await expect(variation).toHaveValue("");
  await variation.fill("2");
  await row.locator(".course-number-input").nth(0).fill("123");
  await expect(variation).toHaveValue("2");
  await expect(row.locator(".course-number-input").nth(4)).toHaveValue("127");
  await expect(row.getByText("Magnetic variation could not be retrieved. Enter it manually or retry later.")).toHaveCount(0);
});

async function loginWithSeededDemoData(page: Page, legacy = false) {
  await page.goto("/login");
  const demoLogin = page.getByRole("button", { name: "Try the demo" });
  await expect(demoLogin).toBeVisible();
  await expect(demoLogin).toBeEnabled();
  await demoLogin.click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await removeDemoLogsheets(page);
  const seedResponse = await page.request.put("/api/logbook/import", { headers: { Origin: "http://127.0.0.1:3000", "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook" },
    data: { boats: sampleBoats.map((boat, index) => index === 0 ? { ...boat, deviationTable: [{ heading: 0, deviation: "2" }] } : boat), crewMembers: crewProfilesFromSheets(sampleLogSheets), sheets: sampleLogSheets.map((sheet, index) => index === 0 ? { ...sheet, lines: sheet.lines.map((line, row) => row === 0 ? legacy ? Object.fromEntries(Object.entries(line).filter(([key]) => key !== "courseFieldSources")) : { ...line, courseFieldSources: { ...courseSourcesFor({}), compassCourse: "input", variation: "input", windDrift: "input", currentDrift: "input" } } : line) } : sheet) },
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
