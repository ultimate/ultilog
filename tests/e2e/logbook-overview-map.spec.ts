import { expect, type Page, test } from "@playwright/test";

const demoSheet = {
  id: "7d3a7602-5f3a-4b3d-81f3-4e973a8bb3a8",
  title: "Ionian training passage · Day 3",
};

test("opens a seeded logsheet detail page from the overview log sheet list", async ({ page }) => {
  await loginWithDemoData(page);
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

async function loginWithDemoData(page: Page) {
  await page.goto("/login");
  const demoLogin = page.getByRole("button", { name: "Try the demo" });
  await expect(demoLogin).toBeVisible();
  await expect(demoLogin).toBeEnabled();
  await demoLogin.click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
}

async function openModule(page: Page, moduleName: string, expectedActionName: string | RegExp) {
  await expect(async () => {
    await page.getByRole("button", { name: moduleName }).click();
    await expect(page.getByRole("button", { name: expectedActionName })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}
