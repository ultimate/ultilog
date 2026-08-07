import { expect, type Locator, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

const demoSheet = sampleLogSheets[0];

test("exposes print actions in the logsheet list and detail view", async ({ page }) => {
  await loginWithSeededDemoData(page);
  await openModule(page, "Logbook list", "+ New sheet");

  await expect(page.getByRole("button", { name: "Print empty" })).toBeVisible();
  const sheetRow = page.locator("tr", { has: page.getByRole("button", { name: demoSheet.title, exact: true }) });
  await expect(sheetRow.getByRole("button", { name: "Print", exact: true })).toBeVisible();

  await page.getByRole("button", { name: demoSheet.title, exact: true }).click();
  await expect(page.getByRole("heading", { name: demoSheet.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print", exact: true })).toBeVisible();
});

test("prints empty sheets with fixed blank rows and print-only layout", async ({ page }) => {
  await mockPrint(page);
  await loginWithSeededDemoData(page);
  await openModule(page, "Logbook list", "+ New sheet");

  await page.getByRole("button", { name: "Print empty", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__printCalls ?? 0)).toBe(1);
  await page.emulateMedia({ media: "print" });

  const printPage = page.locator(".log-sheet-print-page");
  await expect(printPage).toHaveCount(1);
  await expect(printPage.locator(".print-header")).toHaveCount(1);
  await expect(printPage.locator(".print-footer")).toHaveCount(1);
  await expect(printPage.locator(".print-page-number")).toHaveText("Page 1 of 1");
  await expect(printPage.locator(".print-template-marker")).toHaveText("ULTILOG:ultilog-logsheet:v1:full:en");
  await expect(printPage).toHaveAttribute("data-template-id", "ultilog-logsheet");
  await expect(printPage).toHaveAttribute("data-template-revision", "1");
  await expect(printPage).toHaveAttribute("data-template-variant", "full");
  await expect(printPage).toHaveAttribute("data-template-locale", "en");
  await expect(printPage.locator("tbody tr")).toHaveCount(20);
  await expectPrintContentWithinPage(printPage);
  await expect(page.getByRole("navigation", { name: "Primary modules" })).toBeHidden();
});

test("prints filled sheets with filler rows, repeated header/footer, and page numbers", async ({ page }) => {
  await mockPrint(page);
  await loginWithSeededDemoData(page);
  await openModule(page, "Logbook list", "+ New sheet");

  const sheetRow = page.locator("tr", { has: page.getByRole("button", { name: demoSheet.title, exact: true }) });
  await sheetRow.getByRole("button", { name: "Print", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__printCalls ?? 0)).toBe(1);
  await page.emulateMedia({ media: "print" });

  const printPage = page.locator(".log-sheet-print-page");
  await expect(printPage).toHaveCount(1);
  await expect(printPage.locator(".print-header")).toContainText(demoSheet.title);
  await expect(printPage.locator(".print-header .print-field span", { hasText: /^Date$/ })).toHaveCount(0);
  await expect(printPage.locator(".print-header .print-field span", { hasText: /^Skipper$/ })).toHaveCount(0);
  await expect(printPage.locator(".print-crew-box")).toContainText(`⭐ ${demoSheet.crew[0].name}`);
  await expectPrintHeaderFieldsAligned(printPage);
  await expect(printPage.locator(".print-footer")).toHaveCount(1);
  await expect(printPage.locator(".print-page-number")).toHaveText("Page 1 of 1");
  await expect(printPage.locator("tbody tr")).toHaveCount(20);
  await expect(printPage.locator("tbody tr").nth(demoSheet.lines.length)).toBeVisible();
});

test("splits filled sheets that exceed one A4 landscape page", async ({ page }) => {
  await mockPrint(page);
  const longSheet = {
    ...demoSheet,
    id: "print-long-sheet",
    title: "Long printable passage",
    lines: Array.from({ length: 20 }, (_, index) => ({
      ...demoSheet.lines[index % demoSheet.lines.length],
      time: `2026-05-14T${String(index).padStart(2, "0")}:00`,
      remarks: index === 0 ? "A very long remark that should shrink rather than changing the fixed print row height for the printed logbook sheet." : demoSheet.lines[index % demoSheet.lines.length].remarks,
    })),
  };

  await loginWithSeededDemoData(page, [longSheet]);
  await openModule(page, "Logbook list", "+ New sheet");

  const sheetRow = page.locator("tr", { has: page.getByRole("button", { name: longSheet.title, exact: true }) });
  await sheetRow.getByRole("button", { name: "Print", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__printCalls ?? 0)).toBe(1);
  await page.emulateMedia({ media: "print" });

  const printPages = page.locator(".log-sheet-print-page");
  await expect(printPages).toHaveCount(2);
  await expect(printPages.locator(".print-header")).toHaveCount(2);
  await expect(printPages.locator(".print-footer")).toHaveCount(2);
  await expect(printPages.nth(0).locator(".print-page-number")).toHaveText("Page 1 of 2");
  await expect(printPages.nth(1).locator(".print-page-number")).toHaveText("Page 2 of 2");
  await expect(printPages.locator(".print-template-marker")).toHaveCount(2);
  await expect(printPages.nth(0).locator("tbody tr")).toHaveCount(20);
  await expect(printPages.nth(1).locator("tbody tr")).toHaveCount(20);
  await expect(printPages.nth(0).locator(".print-remark-small, .print-remark-tiny")).toHaveCount(1);
});

async function expectPrintContentWithinPage(printPage: Locator) {
  const bounds = await printPage.evaluate((pageElement) => {
    const pageBox = pageElement.getBoundingClientRect();
    const logTableBox = pageElement.querySelector(".print-log-table")?.getBoundingClientRect();
    const footerBox = pageElement.querySelector(".print-footer")?.getBoundingClientRect();

    return {
      pageRight: pageBox.right,
      logTableRight: logTableBox?.right ?? pageBox.right,
      footerRight: footerBox?.right ?? pageBox.right,
    };
  });

  expect(bounds.logTableRight).toBeLessThanOrEqual(bounds.pageRight + 1);
  expect(bounds.footerRight).toBeLessThanOrEqual(bounds.pageRight + 1);
}

async function expectPrintHeaderFieldsAligned(printPage: Locator) {
  const heights = await printPage.evaluate((pageElement) => {
    const box = (selector: string) => pageElement.querySelector(selector)?.getBoundingClientRect();
    const voyage = box(".print-master-grid .print-field");
    const boatSecondRow = box(".print-boat .print-field:nth-child(4)");
    const summarySecondRow = box(".print-summary .print-field:nth-child(3)");
    return {
      voyageHeight: voyage?.height ?? 0,
      boatHeight: boatSecondRow?.height ?? 0,
      summaryHeight: summarySecondRow?.height ?? 0,
      voyageTop: voyage?.top ?? 0,
      boatTop: boatSecondRow?.top ?? 0,
      summaryTop: summarySecondRow?.top ?? 0,
    };
  });

  expect(heights.voyageHeight).toBeGreaterThan(0);
  expect(Math.abs(heights.boatHeight - heights.voyageHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(heights.summaryHeight - heights.voyageHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(heights.boatTop - heights.voyageTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(heights.summaryTop - heights.voyageTop)).toBeLessThanOrEqual(1);
}

async function loginWithSeededDemoData(page: Page, sheets = sampleLogSheets) {
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const email = `print-${unique}@example.test`;
  const password = "correct horse battery staple";

  const registerResponse = await page.request.post("/api/register", {
    data: { name: `Print Tester ${unique}`, email, password },
  });
  expect(registerResponse.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expectLoggedIn(page);

  const seedResponse = await page.request.put("/api/logbook", {
    data: { boats: sampleBoats, crewMembers: crewProfilesFromSheets(sheets), sheets },
  });
  expect(seedResponse.ok()).toBeTruthy();
  await page.reload();
  await expectLoggedIn(page);
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

async function mockPrint(page: Page) {
  await page.addInitScript(() => {
    window.__printCalls = 0;
    window.print = () => {
      window.__printCalls = (window.__printCalls ?? 0) + 1;
    };
  });
}

declare global {
  interface Window {
    __printCalls?: number;
  }
}

async function expectLoggedIn(page: Page) {
  await expect(async () => {
    const continueToApp = page.getByRole("button", { name: "Continue to app" });
    if (await continueToApp.isVisible({ timeout: 500 }).catch(() => false)) await continueToApp.click();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}
