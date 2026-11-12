import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

const origin = "http://127.0.0.1:3000";
const headers = { Origin: origin };
const password = "correct horse battery staple";

async function register(page: Page, role: string) {
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const email = `sharing-${role}-${unique}@example.test`;
  const response = await page.request.post("/api/register", { data: { name: `Sharing ${role} ${unique}`, email, password } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const { id } = await response.json() as { id: string };
  return { email, id };
}

async function login(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue to app" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to app" }).click();
}

async function seed(page: Page, sheets: typeof sampleLogSheets) {
  const crewMembers = sheets.flatMap(sheet => sheet.crew).filter((crew, index, all) => all.findIndex(candidate => candidate.id === crew.id) === index).map(({ embarkationDateTime: _a, embarkationPosition: _b, disembarkationDateTime: _c, disembarkationPosition: _d, ...crew }) => crew);
  const response = await page.request.put("/api/logbook/import", {
    headers: { ...headers, "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook" }, data: { boats: sampleBoats, crewMembers, sheets },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

test("returns from login to a filtered share and reviews a mixed batch of new copies and updates", async ({ browser, page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => window.localStorage.setItem("ultilog-cookie-notice-acknowledged", "true"));
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  await page.context().route(/^https:\/\//, route => route.abort());
  const sourceContext = await browser.newContext();
  await sourceContext.route(/^https:\/\//, route => route.abort());
  try {
    const sourcePage = await sourceContext.newPage();
    sourcePage.setDefaultTimeout(15_000);
    sourcePage.setDefaultNavigationTimeout(30_000);
    const source = await register(sourcePage, "source");
    await sourcePage.goto("/login");
    await login(sourcePage, source.email);
    await expect(sourcePage.getByRole("button", { name: "Logout" })).toBeVisible();
    const shared = sampleLogSheets.slice(0, 2).map((sheet, index) => ({ ...sheet, title: `Sharing voyage ${index + 1}`, route: { ...sheet.route, departed: `2026-05-${14 + index}T08:00:00Z`, arrived: `2026-05-${14 + index}T18:00:00Z` }, share: { masterData: "public", remarks: "public", logLines: "public", technicalLog: "public", picture: "public", metrics: "public", skipper: "public", crew: "public" } as const }));
    await seed(sourcePage, shared);

    const recipient = await register(page, "recipient");
    const sharePath = `/share/${source.id}?view=list&from=2020-01-01`;
    await page.goto(sharePath);
    await page.getByRole("link", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/callbackUrl=/);
    await login(page, recipient.email);
    await expect(page).toHaveURL(`${origin}${sharePath}`);
    await seed(page, []);
    const destinationBoatId = sampleBoats[0].id;
    const firstCopyResponse = await page.request.post(`/api/shared/logbooks/${source.id}/${shared[0].id}/copy`, { headers, data: { destinationBoatId } });
    if (!firstCopyResponse.ok()) throw new Error(`Copy failed: HTTP ${firstCopyResponse.status()} ${await firstCopyResponse.text()}`);
    const firstCopy = await firstCopyResponse.json() as { id: string };
    await page.reload();
    const cookieNotice = page.getByRole("button", { name: "Got it" });
    if (await cookieNotice.isVisible()) await cookieNotice.click();
    await page.getByRole("checkbox", { name: "Select all visible eligible sheets" }).check();
    await page.getByRole("button", { name: "Copy selected (2)" }).click();
    const dialog = page.getByRole("dialog");
    const existingRow = dialog.getByRole("group", { name: shared[0].title, exact: true });
    const newRow = dialog.getByRole("group", { name: shared[1].title, exact: true });
    await expect(existingRow.locator(".shared-copy-badge")).toHaveText("Update existing copy");
    await expect(newRow.locator(".shared-copy-badge")).toHaveText("New copy");
    await expect(dialog.getByText("Updating overwrites local voyage contents.", { exact: false })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await dialog.getByRole("button", { name: "Confirm: 1 new, 1 updates" }).click();
    await expect(dialog.getByRole("link", { name: "Open saved sheet" })).toHaveCount(2);
    const stored = await (await page.request.get("/api/logbook")).json();
    expect(stored.sheets).toHaveLength(2);
    expect(stored.sheets.some((sheet: { id: string }) => sheet.id === firstCopy.id)).toBe(true);
    await page.goto(`/share/${source.id}/${shared[0].id}`);
    await page.waitForLoadState("networkidle");
    const importButton = page.locator(".shared-copy-action > button");
    await expect(importButton).toBeEnabled();
    await expect(importButton).toHaveClass(/primary-action/);
    await importButton.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(importButton).toBeFocused();
    await expect(importButton).toHaveCSS("outline-style", "solid");
    await importButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  } finally { await sourceContext.close(); }
});
