import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

const targetSheet = sampleLogSheets[0];

test("edits technical log entries and suggests previous checks", async ({ page }) => {
  await loginWithSeededDemoData(page);
  await page.goto(`/details/${targetSheet.id}`);

  await expect(page.getByRole("heading", { name: targetSheet.title })).toBeVisible();
  await expect(page.getByText("08-12: Luca / Jonas")).toHaveCount(0);
  await expect(page.getByLabel("Technical log entry 1")).toHaveValue("Engine oil checked");
  await expect(page.locator('datalist#technical-log-suggestions option[value="Fuel valves open"]')).toHaveCount(1);

  await page.getByLabel("New technical log entry").fill("✅ Generator belt inspected");
  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.getByLabel("Technical log entry 6")).toHaveValue("✅ Generator belt inspected");

  await page.getByLabel("Technical log entry 6").fill("⚠️ Generator belt recheck tomorrow");
  await page.getByLabel("Technical log entry 6").blur();
  await expect(page.getByLabel("Technical log entry 6")).toHaveValue("⚠️ Generator belt recheck tomorrow");

  await page.getByLabel("Technical log entry 6").locator("xpath=..").getByRole("button", { name: "🗑️" }).click();
  await expect(page.getByLabel("Technical log entry 6")).toHaveCount(0);
});

async function loginWithSeededDemoData(page: Page) {
  await page.goto("/login");
  const demoLogin = page.getByRole("button", { name: "Try the demo" });
  await expect(demoLogin).toBeVisible();
  await expect(demoLogin).toBeEnabled();
  await demoLogin.click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
  const seedResponse = await page.request.put("/api/logbook", {
    data: { boats: sampleBoats, crewMembers: crewProfilesFromSheets(sampleLogSheets), sheets: sampleLogSheets },
  });
  expect(seedResponse.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
}

function crewProfilesFromSheets(sheets: typeof sampleLogSheets) {
  return sheets.flatMap((sheet) => sheet.crew).filter((crew, index, crews) => crews.findIndex((candidate) => candidate.id === crew.id) === index).map(({ embarkationDateTime, embarkationPosition, disembarkationDateTime, disembarkationPosition, ...crew }) => crew);
}
