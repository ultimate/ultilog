import { expect, type Page, test } from "@playwright/test";

test("persists user-created crew, boat, and logbook sheets across refresh and relogin", async ({ page }) => {
  const unique = Date.now().toString(36);
  const email = `e2e-${unique}@example.test`;
  const password = "correct horse battery staple";
  const crewName = `Crew ${unique}`;
  const boatName = `Boat ${unique}`;
  const sheetTitle = `Sheet ${unique}`;

  const registerResponse = await page.request.post("/api/register", {
    data: { name: `E2E Skipper ${unique}`, email, password },
  });
  expect(registerResponse.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await clickButton(page, "Log in");
  await expectLoggedIn(page);
  await expect(page.getByRole("heading", { name: "Onboarding checklist" })).toBeVisible();
  await expect(page.getByText("Read the compliance information for your country")).toBeVisible();
  await expect(page.getByText("Create your first boat")).toBeVisible();
  await openModule(page, "Logbook list", "+ New sheet");
  await expect(page.getByRole("button", { name: "Ionian training passage · Day 3", exact: true })).toHaveCount(0);

  await openModule(page, "Crew manager", "New crew");
  await clickButton(page, "New crew");
  const crewForm = page.locator("form").filter({ hasText: "New crew" });
  await crewForm.getByLabel("Name", { exact: true }).fill(crewName);
  await crewForm.getByLabel("Nationality").fill("Swiss");
  await crewForm.getByLabel("Role").fill("Navigator");
  const crewSave = waitForLogbookSave(page);
  await clickButton(page, "Save crew");
  await crewSave;
  await expect(page.getByText(crewName)).toBeVisible();

  await openModule(page, "Boat manager", "New boat");
  await clickButton(page, "New boat");
  const boatForm = page.locator("form").filter({ hasText: "New boat" });
  await boatForm.getByLabel("Name", { exact: true }).fill(boatName);
  await boatForm.getByLabel("Registration").fill(`REG-${unique}`);
  await boatForm.getByLabel("Flag state").selectOption("🇨🇭");
  await boatForm.getByLabel("Home port").fill("Basel");
  await boatForm.getByLabel("Owner").fill("E2E Owner");
  await clickButton(page, "Create boat");
  await expect(page.getByText(boatName)).toBeVisible();

  await openModule(page, "Logbook list", "+ New sheet");
  await clickButton(page, "+ New sheet");
  const sheetForm = page.locator("form").filter({ hasText: "New sheet" });
  await sheetForm.getByLabel("Title").fill(sheetTitle);
  await sheetForm.getByLabel("Boat").selectOption({ label: boatName });
  await sheetForm.getByLabel("From position").fill("Port A");
  await sheetForm.getByLabel("To position").fill("Port B");
  await clickButton(page, "Save");
  await expect(page.getByRole("heading", { name: sheetTitle })).toBeVisible();
  await expect(page.getByText(`1. ⭐ Skipper · E2E Skipper ${unique}`)).toBeVisible();

  await page.getByLabel("Add crew member").selectOption({ label: crewName });
  const addedCrewRow = page.locator("li").filter({ hasText: `2. ${crewName}` });
  await expect(addedCrewRow).toBeVisible();
  const deleteSave = page.waitForResponse((response) => response.url().endsWith("/api/logbook") && response.request().method() === "PUT" && response.ok());
  await addedCrewRow.getByRole("button", { name: `Delete ${crewName}` }).click();
  await expect(addedCrewRow).toBeHidden();
  await deleteSave;

  await page.reload();
  await expectLoggedIn(page);
  await assertCreatedItemsVisible(page, { crewName, boatName, sheetTitle });

  await clickButton(page, "Logout");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await clickButton(page, "Log in");
  await expectLoggedIn(page);
  await assertCreatedItemsVisible(page, { crewName, boatName, sheetTitle });
});

async function assertCreatedItemsVisible(page: Page, items: { crewName: string; boatName: string; sheetTitle: string }) {
  await openModule(page, "Logbook list", "+ New sheet");
  await expect(page.getByRole("button", { name: items.sheetTitle, exact: true })).toBeVisible();

  await openModule(page, "Boat manager", "New boat");
  await expect(page.getByText(items.boatName)).toBeVisible();

  await openModule(page, "Crew manager", "New crew");
  await expect(page.getByText(items.crewName)).toBeVisible();
}

async function openModule(page: Page, moduleName: string, expectedActionName: string | RegExp) {
  await expect(async () => {
    await page.getByRole("button", { name: moduleName }).click();
    await expect(page.getByRole("button", { name: expectedActionName })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

function waitForLogbookSave(page: Page) {
  return page.waitForResponse((response) => response.url().endsWith("/api/logbook") && response.request().method() === "PUT" && response.ok());
}

async function clickButton(page: Page, name: string | RegExp) {
  await expect(async () => {
    const button = page.getByRole("button", { name });
    await expect(button).toBeVisible({ timeout: 2_000 });
    await expect(button).toBeEnabled({ timeout: 2_000 });
    await button.click();
  }).toPass({ timeout: 15_000 });
}

async function expectLoggedIn(page: Page) {
  await expect(async () => {
    const continueToApp = page.getByRole("button", { name: "Continue to app" });
    if (await continueToApp.isVisible({ timeout: 500 }).catch(() => false)) await continueToApp.click();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}
