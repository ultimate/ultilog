import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

const demoSheet = {
  id: "7d3a7602-5f3a-4b3d-81f3-4e973a8bb3a8",
  title: "Ionian training passage · Day 3",
};

test("opens a seeded logsheet detail page from the overview log sheet list", async ({ page }) => {
  await loginWithSeededDemoData(page);
  await openModule(page, "Logbook list", "+ New sheet");

  const overviewMap = page.getByLabel("Overview map of all log sheets");
  await expect(overviewMap).toBeVisible();
  await expect(overviewMap.locator(".leaflet-container")).toBeVisible();

  const sheetLink = page.getByRole("button", { name: demoSheet.title });
  await expect(sheetLink).toBeVisible();
  await sheetLink.click();

  await expect(page).toHaveURL(new RegExp(`/details/${demoSheet.id}$`));
  await expect(page.getByRole("heading", { name: demoSheet.title })).toBeVisible();
  await expect(page.getByLabel("Logbook sheet header")).toContainText("Preveza Marina");
  await expect(page.getByLabel("Logbook sheet header")).toContainText("Fiskardo");

  const logLineRows = page.locator(".log-lines-table tbody tr");
  await expect(logLineRows).toHaveCount(sampleLogSheets[0].lines.length);
  await expect(logLineRows.nth(0).locator("td").first()).toHaveText("1");
  await expect(logLineRows.nth(1).locator("td").first()).toHaveText("2");
  await expect(page.locator(".open-seamap-detail .open-seamap-marker b")).toHaveText(
    sampleLogSheets[0].lines.map((_, index) => `${index + 1}`),
  );
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
}

function crewProfilesFromSheets(sheets: typeof sampleLogSheets) {
  return sheets.flatMap((sheet) => sheet.crew).filter((crew, index, crews) => crews.findIndex((candidate) => candidate.id === crew.id) === index).map(({ embarkationDateTime, embarkationPosition, disembarkationDateTime, disembarkationPosition, ...crew }) => crew);
}

async function openModule(page: Page, moduleName: string, expectedActionName: string | RegExp) {
  await expect(async () => {
    await page.getByRole("button", { name: moduleName }).click();
    await expect(page.getByRole("button", { name: expectedActionName })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}
