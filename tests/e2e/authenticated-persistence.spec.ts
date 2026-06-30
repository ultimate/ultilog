import { expect, type Page, test } from "@playwright/test";

test("persists user-created crew, boat, and logbook sheets across refresh and relogin", async ({ page }) => {
  const unique = Date.now().toString(36);
  const email = `e2e-${unique}@example.test`;
  const password = "correct horse battery staple";
  const crewName = `Crew ${unique}`;
  const boatName = `Boat ${unique}`;
  const sheetTitle = `Sheet ${unique}`;

  await page.goto("/register");
  await page.getByLabel("Name").fill(`E2E Skipper ${unique}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

  await openModule(page, "Crew manager", "New crew");
  await page.getByRole("button", { name: "New crew" }).click();
  const crewForm = page.locator("form").filter({ hasText: "New crew" });
  await crewForm.getByLabel("Name").fill(crewName);
  await crewForm.getByLabel("Nationality").fill("Swiss");
  await crewForm.getByLabel("Role").fill("Navigator");
  await page.getByRole("button", { name: "Save crew" }).click();
  await expect(page.getByText(crewName)).toBeVisible();

  await openModule(page, "Boat manager", "New boat");
  await page.getByRole("button", { name: "New boat" }).click();
  const boatForm = page.locator("form").filter({ hasText: "New boat" });
  await boatForm.getByLabel("Name").fill(boatName);
  await boatForm.getByLabel("Registration").fill(`REG-${unique}`);
  await boatForm.getByLabel("Flag state").fill("CH");
  await boatForm.getByLabel("Home port").fill("Basel");
  await boatForm.getByLabel("Owner").fill("E2E Owner");
  await page.getByRole("button", { name: "Create boat" }).click();
  await expect(page.getByText(boatName)).toBeVisible();

  await openModule(page, "Logbook list", "+ New sheet");
  await page.getByRole("button", { name: "+ New sheet" }).click();
  const sheetForm = page.locator("form").filter({ hasText: "New sheet" });
  await sheetForm.getByLabel("Title").fill(sheetTitle);
  await sheetForm.getByLabel("Boat").selectOption({ label: boatName });
  await sheetForm.getByLabel("Day goal").fill("Persistence test passage");
  await sheetForm.getByLabel("From").fill("Port A");
  await sheetForm.getByLabel("To").fill("Port B");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(sheetTitle)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await assertCreatedItemsVisible(page, { crewName, boatName, sheetTitle });

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await assertCreatedItemsVisible(page, { crewName, boatName, sheetTitle });
});

async function assertCreatedItemsVisible(page: Page, items: { crewName: string; boatName: string; sheetTitle: string }) {
  await openModule(page, "Logbook list", "+ New sheet");
  await expect(page.getByText(items.sheetTitle)).toBeVisible();

  await openModule(page, "Boat manager", "New boat");
  await expect(page.getByText(items.boatName)).toBeVisible();

  await openModule(page, "Logbook list", "+ New sheet");
  await page.getByRole("button", { name: /Ionian training passage · Day 3/ }).click();
  await openModule(page, "Crew manager", "New crew");
  await expect(page.getByText(items.crewName)).toBeVisible();
}

async function openModule(page: Page, moduleName: string, expectedActionName: string | RegExp) {
  await expect(async () => {
    await page.getByRole("button", { name: moduleName }).click();
    await expect(page.getByRole("button", { name: expectedActionName })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}
