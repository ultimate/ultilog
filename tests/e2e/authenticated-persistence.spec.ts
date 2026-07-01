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
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

  await page.goto("/crew");
  await page.getByRole("button", { name: "New crew" }).click();
  const crewForm = page.locator("form").filter({ hasText: "New crew" });
  await crewForm.getByLabel("Name").fill(crewName);
  await crewForm.getByLabel("Nationality").fill("Swiss");
  await crewForm.getByLabel("Role").fill("Navigator");
  await page.getByRole("button", { name: "Save crew" }).click();
  await expect(page.getByText(crewName)).toBeVisible();

  await page.goto("/boats");
  await page.getByRole("button", { name: "New boat" }).click();
  const boatForm = page.locator("form").filter({ hasText: "New boat" });
  await boatForm.getByLabel("Name").fill(boatName);
  await boatForm.getByLabel("Registration").fill(`REG-${unique}`);
  await boatForm.getByLabel("Flag state").fill("CH");
  await boatForm.getByLabel("Home port").fill("Basel");
  await boatForm.getByLabel("Owner").fill("E2E Owner");
  await page.getByRole("button", { name: "Create boat" }).click();
  await expect(page.getByText(boatName)).toBeVisible();

  await page.goto("/logbooks");
  await page.getByRole("button", { name: "+ New sheet" }).click();
  const sheetForm = page.locator("form").filter({ hasText: "New sheet" });
  await sheetForm.getByLabel("Title").fill(sheetTitle);
  await sheetForm.getByLabel("Boat").selectOption({ label: boatName });
  await sheetForm.getByLabel("From position").fill("Port A");
  await sheetForm.getByLabel("To position").fill("Port B");
  await page.getByRole("button", { name: "Save" }).click();
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
  await page.goto("/logbooks");
  await expect(page.getByRole("button", { name: items.sheetTitle })).toBeVisible();

  await page.goto("/boats");
  await expect(page.getByText(items.boatName)).toBeVisible();

  await page.goto("/logbooks");
  await page.getByRole("button", { name: /Ionian training passage · Day 3/ }).click();
  await page.goto("/crew");
  await expect(page.getByText(items.crewName)).toBeVisible();
}
