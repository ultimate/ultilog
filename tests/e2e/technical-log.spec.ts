import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

const targetSheet = sampleLogSheets[0];
const legacyIdSheet = { ...sampleLogSheets[1], id: "legacy-normalization-sheet", title: "Legacy ID normalization check", crew: [], lines: [] };

test("edits technical log entries and suggests previous checks", async ({ page }) => {
  await loginWithSeededDemoData(page);
  await expect.poll(async () => {
    const stored = await (await page.request.get("/api/logbook")).json();
    const normalized = stored.sheets.find((sheet: { title: string }) => sheet.title === legacyIdSheet.title);
    return Boolean(normalized && normalized.id !== legacyIdSheet.id);
  }).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await expect.poll(async () => {
    const stored = await (await page.request.get("/api/logbook")).json();
    return stored.sheets.filter((sheet: { title: string }) => sheet.title === legacyIdSheet.title).length;
  }).toBe(1);
  await page.goto(`/details/${targetSheet.id}`);

  await expect(page.getByRole("heading", { name: targetSheet.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checks", level: 4 })).toBeVisible();
  await expect(page.getByText("08-12: Luca / Jonas")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Technical log entry 1" })).toHaveValue("Engine oil checked");
  await expect(page.locator('datalist#technical-log-suggestions option[value="Fuel valves open"]')).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "Check status 1" })).toHaveValue("⌛");
  await page.getByRole("spinbutton", { name: "Main engine Beginning of sheet" }).fill("120.5");
  await page.getByRole("spinbutton", { name: "Main engine End of sheet" }).fill("121.5");
  await page.getByRole("spinbutton", { name: "Main engine End of sheet" }).blur();
  await expect(page.getByRole("row", { name: /Counter difference/ })).toContainText("1.0 h");
  await expect(page.getByRole("row", { name: /Runtime tracked on sheet/ })).toContainText("1.0 h");
  await expect.poll(async () => {
    const stored = await (await page.request.get("/api/logbook")).json();
    return stored.sheets.find((sheet: { id: string }) => sheet.id === targetSheet.id)?.engineHourCounters?.["main-engine"];
  }).toEqual({ start: 120.5, end: 121.5 });
  await expect(page.getByText("Unable to save the latest changes. Please try again.")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("spinbutton", { name: "Main engine Beginning of sheet" })).toHaveValue("120.5");
  await expect(page.getByRole("spinbutton", { name: "Main engine End of sheet" })).toHaveValue("121.5");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".engine-hour-counter-section .table-scroll").scrollIntoViewIfNeeded();
  await expect(page.locator(".engine-hour-counter-section .table-scroll")).toBeInViewport();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("combobox", { name: "Check status 1" }).selectOption("✅");
  await expect(page.getByRole("combobox", { name: "Check status 1" })).toHaveValue("✅");

  await page.getByRole("combobox", { name: "New technical log entry" }).fill("✅ Generator belt inspected");
  await page.getByRole("button", { name: "Add technical log entry" }).click();
  await expect(page.getByRole("combobox", { name: "Technical log entry 6" })).toHaveValue("✅ Generator belt inspected");

  await page.getByRole("combobox", { name: "Technical log entry 6" }).fill("⚠️ Generator belt recheck tomorrow");
  await page.getByRole("button", { name: "Save Technical log entry 6" }).click();
  await expect(page.getByRole("combobox", { name: "Technical log entry 6" })).toHaveValue("⚠️ Generator belt recheck tomorrow");

  await page.getByRole("button", { name: "Delete technical log entry 6" }).click();
  await expect(page.getByRole("combobox", { name: "Technical log entry 6" })).toHaveCount(0);

  await page.getByRole("button", { name: "Lock" }).click();
  await expect(page.getByRole("combobox", { name: "Technical log entry 1" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "New technical log entry" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete technical log entry 1" })).toBeDisabled();

  const motorSheet = sampleLogSheets[1];
  await page.goto(`/details/${motorSheet.id}`);
  const firstLine = page.locator(".log-lines-table tbody tr").first();
  await firstLine.getByRole("button", { name: "✏️" }).click();
  await page.getByRole("spinbutton", { name: "Port engine Engine runtime increment" }).fill("0.5");
  await page.getByRole("spinbutton", { name: "Starboard engine Engine runtime increment" }).fill("0.6");
  await firstLine.getByRole("button", { name: "💾" }).click();
  await expect.poll(async () => {
    const stored = await (await page.request.get("/api/logbook")).json();
    return stored.sheets.find((sheet: { id: string }) => sheet.id === motorSheet.id)?.lines[0]?.engineHours;
  }).toEqual({ "port-engine": 0.5, "starboard-engine": 0.6 });
  await expect(page.getByText("Unable to save the latest changes. Please try again.")).toHaveCount(0);
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
    data: { boats: sampleBoats, crewMembers: crewProfilesFromSheets(sampleLogSheets), sheets: [...sampleLogSheets, legacyIdSheet] },
  });
  expect(seedResponse.ok(), await seedResponse.text()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
}

async function removeDemoLogsheets(page: Page) {
  const currentResponse = await page.request.get("/api/logbook");
  expect(currentResponse.ok()).toBeTruthy();
  const currentLogbook = await currentResponse.json();
  // Clear the sheets atomically before replacing demo boat IDs. Individual
  // deletes can race the client's queued normalization saves after login.
  const clearResponse = await page.request.put("/api/logbook/import", { headers: { Origin: "http://127.0.0.1:3000", "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook" }, data: { ...currentLogbook, sheets: [] } });
  expect(clearResponse.ok(), await clearResponse.text()).toBeTruthy();
  await expect.poll(async () => (await (await page.request.get("/api/logbook")).json()).sheets.length).toBe(0);
}

function crewProfilesFromSheets(sheets: typeof sampleLogSheets) {
  return sheets.flatMap((sheet) => sheet.crew).filter((crew, index, crews) => crews.findIndex((candidate) => candidate.id === crew.id) === index).map(({ embarkationDateTime, embarkationPosition, disembarkationDateTime, disembarkationPosition, ...crew }) => crew);
}
