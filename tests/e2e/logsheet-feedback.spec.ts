import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

test.setTimeout(180_000);

test("shows motor-boat columns and preserves a line after a failed save while blocking duplicate submits", async ({ page }) => {
  await page.route(/^https:\/\/(?:tile\.openstreetmap\.org|tiles\.openseamap\.org)\//, route => route.fulfill({ status: 204 }));
  await loginWithSeededDemoData(page);
  const motorSheet = sampleLogSheets[1];
  await page.goto(`/details/${motorSheet.id}`);
  const table = page.locator(".log-lines-table");
  await expect(table.getByRole("columnheader", { name: "Sail", exact: true })).toHaveCount(0);
  const row = table.locator("tbody tr").first();
  await row.getByRole("button", { name: "✏️" }).click();
  await expect(row.locator('[data-line-field="sailMiles"]')).toHaveCount(0);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route(`**/api/logbook/sheets/${motorSheet.id}/lines/*`, async route => {
    if (route.request().method() !== "PUT") return route.continue();
    requests++;
    await gate;
    await route.fulfill({ status: 500, json: { error: "Temporary test failure" } });
  });
  const save = row.getByRole("button", { name: "💾" });
  await save.click();
  await expect(row.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await expect(row.locator(".save-spinner")).toBeVisible();
  await row.locator('button[aria-busy="true"]').evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(() => requests).toBe(1);
  release();
  await expect(save).toBeEnabled();
  await expect(row).toHaveClass(/inline-line-row/);
  await page.unroute(`**/api/logbook/sheets/${motorSheet.id}/lines/*`);
  await save.click();
  await expect(row.locator("input")).toHaveCount(0);
});

test("highlights calculated course values without highlighting the typed value", async ({ page }) => {
  await page.route(/^https:\/\/(?:tile\.openstreetmap\.org|tiles\.openseamap\.org)\//, route => route.fulfill({ status: 204 }));
  await loginWithSeededDemoData(page);
  await page.goto(`/details/${sampleLogSheets[0].id}`);
  const row = page.locator(".log-lines-table tbody tr").first();
  await row.getByRole("button", { name: "✏️" }).click();
  const showCourses = page.getByRole("button", { name: "Show course conversion columns", exact: true });
  if (await showCourses.count()) await showCourses.click();
  const compass = row.locator(".course-number-input").first();
  await row.locator(".course-number-input").nth(2).fill("");
  await compass.fill("123");
  await expect(compass).not.toHaveClass(/course-autofilled/);
  await expect(row.locator(".course-autofilled").first()).toBeVisible();
  await expect(row.locator(".course-autofilled")).toHaveCount(0, { timeout: 5000 });
  await row.locator(".course-number-input").nth(2).fill("");
  await compass.fill("124");
  await expect(row.locator(".course-autofilled").first()).toBeVisible();
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
    data: { boats: sampleBoats, crewMembers: crewProfilesFromSheets(sampleLogSheets), sheets: sampleLogSheets },
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
