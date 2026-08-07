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
  const seedResponse = await page.request.put("/api/logbook", {
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
  const clearResponse = await page.request.put("/api/logbook", {
    data: { ...currentLogbook, sheets: [] },
  });
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
