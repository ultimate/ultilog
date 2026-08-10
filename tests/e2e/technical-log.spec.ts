import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

const targetSheet = sampleLogSheets[0];

test("edits technical log entries and suggests previous checks", async ({ page }) => {
  await loginWithSeededDemoData(page);
  await page.goto(`/details/${targetSheet.id}`);

  await expect(page.getByRole("heading", { name: targetSheet.title })).toBeVisible();
  await expect(page.getByText("08-12: Luca / Jonas")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Technical log entry 1" })).toHaveValue("Engine oil checked");
  await expect(page.locator('datalist#technical-log-suggestions option[value="Fuel valves open"]')).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "Check status 1" })).toHaveValue("⌛");
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
  for (const sheet of currentLogbook.sheets) {
    const clearResponse = await page.request.delete(`/api/logbook/sheets/${encodeURIComponent(sheet.id)}`);
    expect(clearResponse.ok(), await clearResponse.text()).toBeTruthy();
  }
}

function crewProfilesFromSheets(sheets: typeof sampleLogSheets) {
  return sheets.flatMap((sheet) => sheet.crew).filter((crew, index, crews) => crews.findIndex((candidate) => candidate.id === crew.id) === index).map(({ embarkationDateTime, embarkationPosition, disembarkationDateTime, disembarkationPosition, ...crew }) => crew);
}
