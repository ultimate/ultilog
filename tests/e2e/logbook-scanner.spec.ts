import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

test("imports a scanned logbook image and opens the created draft sheet", async ({ page }) => {
  const createdSheetId = "11111111-2222-4333-8444-555555555555";
  let scannerRequestReceived = false;

  await loginWithSeededRegisteredData(page);
  await openModule(page, "Logbook list", "+ New sheet");

  const currentLogbookResponse = await page.request.get("/api/logbook");
  expect(currentLogbookResponse.ok()).toBeTruthy();
  const currentLogbook = await currentLogbookResponse.json();
  const scannedSheet = {
    id: createdSheetId,
    title: "Scanned marina departure",
    dateRange: "04 Jul 2026",
    status: "Draft",
    source: "scanner",
    verificationNote: "Please verify scanned information before locking this sheet.",
    scannerWarnings: ["Verify the scanned engine hours."],
    boatId: currentLogbook.boats[0].id,
    route: {
      from: "Sample Harbor",
      to: "Test Anchorage",
      departed: "04 Jul 2026, 09:00",
      arrived: "04 Jul 2026, 11:30",
    },
    crew: [],
    watchPlan: [],
    technicalChecks: [],
    lines: [],
  };

  await page.route("**/api/logbook/scanner", async (route) => {
    scannerRequestReceived = true;
    expect(route.request().method()).toBe("POST");
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ sheetId: createdSheetId }),
    });
  });

  await page.route("**/api/logbook", async (route) => {
    if (route.request().method() === "GET" && scannerRequestReceived) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...currentLogbook,
          sheets: [...currentLogbook.sheets, scannedSheet],
        }),
      });
      return;
    }
    await route.continue();
  });

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import photos" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "sample-logbook-scan.png",
    mimeType: "image/png",
    buffer: Buffer.from(samplePngBase64, "base64"),
  });

  await expect(page.getByRole("dialog", { name: "Privacy notice before upload" })).toBeVisible();
  await page.getByRole("button", { name: "Continue and upload" }).click();
  await expect(page.getByRole("status")).toContainText("Scanning logbook photo");
  await expect(page.getByRole("progressbar", { name: "Scanning logbook photo…" })).toBeVisible();

  await expect(page).toHaveURL(new RegExp(`/details/${createdSheetId}$`));
  await expect(page.getByRole("heading", { name: scannedSheet.title })).toBeVisible();
  await expect(page.getByLabel("Scanned draft verification notice")).toBeVisible();
  await expect(page.getByLabel("Scanned draft verification notice")).toContainText("Please verify scanned information before locking this sheet.");
  await expect(page.getByLabel("Scanned draft verification notice")).toContainText("Verify the scanned engine hours.");
  expect(scannerRequestReceived).toBeTruthy();
});

async function loginWithSeededRegisteredData(page: Page) {
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const email = `scanner-${unique}@example.test`;
  const password = "correct horse battery staple";

  const registerResponse = await page.request.post("/api/register", {
    data: { name: `Scanner Tester ${unique}`, email, password },
  });
  expect(registerResponse.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
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

async function openModule(page: Page, moduleName: string, expectedActionName: string | RegExp) {
  await expect(async () => {
    await page.getByRole("button", { name: moduleName }).click();
    await expect(page.getByRole("button", { name: expectedActionName })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

const samplePngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
