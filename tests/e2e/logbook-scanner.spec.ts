import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

test.use({ hasTouch: true });

test("imports a scanned logbook image and opens the created draft sheet", async ({ page }) => {
  const createdSheetId = "11111111-2222-4333-8444-555555555555";
  let scannerRequestReceived = false;

  await loginWithSeededRegisteredData(page);
  await openModule(page, "Logbook list", "+ New sheet");
  // Reproduce a stale manual-create state before starting the background scan.
  await page.getByRole("button", { name: "+ New sheet" }).click();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await openModule(page, "Logbook list", "+ New sheet");

  const currentLogbookResponse = await page.request.get("/api/logbook");
  expect(currentLogbookResponse.ok()).toBeTruthy();
  const currentLogbook = await currentLogbookResponse.json();
  let scannedSheet = {
    id: createdSheetId,
    title: "Scanned marina departure",
    dateText: "04 Jul 2026",
    status: "Draft",
    source: "scanner",
    verificationNote: "Please verify scanned information before locking this sheet.",
    scannerWarnings: [{ id: "warning-1", code: "missingFields", row: 1, fields: ["latitude"] }],
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
    lines: sampleLogSheets[0].lines.slice(0, 1),
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
  await page.route(`**/api/logbook/sheets/${createdSheetId}`, async (route) => {
    expect(route.request().method()).toBe("PUT");
    const submittedSheet = route.request().postDataJSON();
    const persistedSheet = {
      ...submittedSheet,
      revision: (submittedSheet.revision ?? 0) + 1,
      createdAt: submittedSheet.createdAt ?? "2026-07-04T09:00:00.000Z",
      updatedAt: "2026-07-04T12:00:00.000Z",
    };
    // Focused sheet updates deliberately omit lines. Merge the returned metadata
    // into the full GET fixture instead of replacing it with the focused payload.
    scannedSheet = { ...scannedSheet, ...persistedSheet, lines: scannedSheet.lines };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(persistedSheet) });
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
  await expect(page.locator(".scanner-upload-status")).toContainText("Scanning logbook photo");
  await expect(page.getByRole("progressbar", { name: "Scanning logbook photo…" })).toBeVisible();

  await expect(page).toHaveURL(new RegExp(`/details/${createdSheetId}$`));
  await expect(page.getByRole("heading", { name: scannedSheet.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).not.toBeVisible();
  await expect(page.getByLabel("Scanned draft verification notice")).toBeVisible();
  await expect(page.getByLabel("Scanned draft verification notice")).toContainText("Please verify scanned information before locking this sheet.");
  const highlightedLatitude = page.locator("td.scanner-warning-field").filter({ hasText: String(scannedSheet.lines[0].latitude) });
  await expect(highlightedLatitude).toHaveAttribute("title", "Row 1 is missing or unclear: Lat.");
  await page.getByLabel("Language").first().selectOption("fr");
  await expect(highlightedLatitude).toHaveAttribute("title", "Ligne 1 manquante ou peu claire : Lat.");
  // The locale switch also translates the select's accessible name, so query it
  // again with its current label instead of reusing an English-label locator.
  await page.getByLabel("Langue").first().selectOption("en");
  await page.setViewportSize({ width: 390, height: 844 });
  await test.step("reviews scanner warnings with the keyboard", async () => {
    await highlightedLatitude.focus();
    await page.keyboard.press("Enter");
    const warningDialog = page.getByRole("dialog", { name: "Row 1 is missing or unclear: Lat." });
    const acknowledgeButton = warningDialog.getByRole("button", { name: "Acknowledge" });
    await expect(acknowledgeButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Scanned draft verification notice")).toContainText("0 active of 1 total warnings");
    await expect(highlightedLatitude).toHaveCount(0);

    await page.getByLabel("Show acknowledged warnings").check();
    const acknowledgedWarningCell = page.locator("td.scanner-warning-field.acknowledged").filter({ hasText: String(scannedSheet.lines[0].latitude) });
    await acknowledgedWarningCell.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").getByRole("button", { name: "Restore warning" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(acknowledgedWarningCell).toBeFocused();
  });

  await page.reload();
  await expect(page.getByLabel("Scanned draft verification notice")).toContainText("0 active of 1 total warnings");
  await expect(page.locator("td.scanner-warning-field").filter({ hasText: String(scannedSheet.lines[0].latitude) })).toHaveCount(0);

  await page.getByLabel("Show acknowledged warnings").check();
  const acknowledgedLatitude = page.locator("td.scanner-warning-field.acknowledged").filter({ hasText: String(scannedSheet.lines[0].latitude) });
  await acknowledgedLatitude.tap();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Restore warning" })).toBeVisible();

  // Warning review is metadata and remains available after the sheet is locked.
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unlock", exact: true })).toBeVisible();
  await acknowledgedLatitude.tap();
  await page.getByRole("dialog").getByRole("button", { name: "Restore warning" }).click();
  await expect(page.getByLabel("Scanned draft verification notice")).toContainText("1 active of 1 total warnings");
  await expect(page.locator("td.scanner-warning-field").filter({ hasText: String(scannedSheet.lines[0].latitude) })).toBeVisible();
  await expect(page.locator(".log-lines-table tbody tr")).toHaveCount(scannedSheet.lines.length);
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
  await expectLoggedIn(page);
  const seedResponse = await page.request.put("/api/logbook/import", { headers: { Origin: "http://127.0.0.1:3000", "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook" },
    data: { boats: sampleBoats, crewMembers: crewProfilesFromSheets(sampleLogSheets), sheets: sampleLogSheets },
  });
  expect(seedResponse.ok()).toBeTruthy();
  await page.reload();
  await expectLoggedIn(page);
}

async function expectLoggedIn(page: Page) {
  await expect(async () => {
    const continueToApp = page.getByRole("button", { name: "Continue to app" });
    if (await continueToApp.isVisible({ timeout: 500 }).catch(() => false)) await continueToApp.click();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
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
