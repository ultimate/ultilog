import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

const demoSheet = {
  id: "7d3a7602-5f3a-4b3d-81f3-4e973a8bb3a8",
  title: "Ionian training passage · Day 3",
};

test("opens a seeded logsheet detail page from the overview log sheet list", async ({ page }) => {
  await loginWithSeededDemoData(page);
  await openModule(page, "Logsheet list", "+ New sheet");

  const overviewMap = page.getByLabel("Overview map of all log sheets");
  await expect(overviewMap).toBeVisible();
  await expect(overviewMap.locator(".leaflet-container")).toBeVisible();

  // Open after scrolling without Playwright scrolling the trigger back into view.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("button", { name: "Full view" }).evaluate((button: HTMLButtonElement) => button.click());
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const viewport of [{ width: 1280, height: 720 }, { width: 375, height: 320 }]) {
    await page.setViewportSize(viewport);
    await expect(async () => {
      const bounds = await dialog.locator(".logbook-map-modal-panel").boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThan(2);
    }).toPass();
  }
  await dialog.getByRole("button", { name: "Close map" }).click();
  await page.setViewportSize({ width: 1280, height: 720 });

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
  await expect.poll(async () => (await (await page.request.get("/api/logbook")).json()).sheets.length).toBe(0);
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
