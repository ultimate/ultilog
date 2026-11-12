import { expect, type Page, test } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

const demoSheet = {
  id: "7d3a7602-5f3a-4b3d-81f3-4e973a8bb3a8",
  title: "Ionian training passage · Day 3",
};

test("opens a seeded logsheet detail page from the overview log sheet list", async ({ page }) => {
  await page.route(/^https:\/\/(?:tile\.openstreetmap\.org|tiles\.openseamap\.org)\//, route => route.fulfill({ status: 204 }));
  await loginWithSeededDemoData(page);
  await openModule(page, "Logsheet list", "+ New sheet");

  const overviewMap = page.getByLabel("Overview map of all log sheets");
  await expect(overviewMap).toBeVisible();
  await expect(overviewMap.locator(".leaflet-container")).toBeVisible();

  await expect(overviewMap.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  await expect(overviewMap.getByRole("link", { name: "CC BY-SA 2.0" })).toBeVisible();
  await overviewMap.locator(".open-seamap-marker").first().click();
  await expect(overviewMap.locator(".leaflet-popup-content")).toBeVisible();
  await overviewMap.locator(".leaflet-popup-close-button").click();

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

  const sheetLink = page.getByRole("link", { name: demoSheet.title });
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
  await expect(page.locator(".weather-data-attribution").first().getByRole("link", { name: "Weather data by Open-Meteo.com" })).toBeVisible();
  const map = page.locator(".open-seamap-detail .leaflet-container");
  await map.click({ button: "right", position: { x: 120, y: 100 } });
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem")).toBeVisible();
  await map.click({ position: { x: 60, y: 50 } });
  await expect(page.getByRole("menu")).toHaveCount(0);
});

for (const format of ["DD (", "DDM (", "DMS ("]) test(`fills a smart line in ${format} coordinates from device location and weather`, async ({ page, context }) => {
  await context.grantPermissions(["geolocation"], { origin: "http://127.0.0.1:3000" });
  await context.setGeolocation({ latitude: 54.1, longitude: 10.2, accuracy: 5 });
  await page.route(/^https:\/\/(?:tile\.openstreetmap\.org|tiles\.openseamap\.org)\//, route => route.fulfill({ status: 204 }));
  await page.addInitScript(() => {
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (...args: Parameters<Geolocation["getCurrentPosition"]>) => {
      (window as unknown as { releaseLocation: () => void }).releaseLocation = () => original(...args);
    };
  });
  let releaseWeather!: () => void;
  const weatherReady = new Promise<void>(resolve => { releaseWeather = resolve; });
  await page.route("**/api/meteo/log-line-autofill", async route => {
    expect(route.request().postDataJSON()).toMatchObject({ latitude: 54.1, longitude: 10.2 });
    await weatherReady;
    await route.fulfill({ json: {
      fields: { temperature: "21", barometer: "1014", weather: sampleLogSheets[0].lines[0].weather },
      remarkParts: [{ fields: ["temperature", "barometer"], provenance: { provider: "open-meteo", providerLabel: "Open-Meteo", sourceType: "fallback" } }],
    } });
  });
  await loginWithSeededDemoData(page);
  await openModule(page, "Logsheet list", "+ New sheet");
  await page.getByRole("link", { name: demoSheet.title }).click();
  // Exercise incoming GPS updates in each displayed coordinate format.
  const coordinates = page.getByRole("button", { name: /^Coordinates:/ });
  for (let attempt = 0; attempt < 3 && !(await coordinates.innerText()).includes(format); attempt++) await coordinates.click();
  const request = page.waitForRequest("**/api/meteo/log-line-autofill");
  await page.getByRole("button", { name: "+ Add smart line", exact: true }).click();
  const draft = page.locator(".inline-line-row").first();
  await expect(draft.locator('[data-loading-field="latitude"] .smart-field-spinner')).toBeVisible();
  await expect(draft.locator('[data-loading-field="longitude"] .smart-field-spinner')).toBeVisible();
  await page.getByRole("button", { name: "+ Add line", exact: true }).click();
  const manualDraft = page.locator(".inline-line-row").last();
  await expect(manualDraft.locator(".smart-field-spinner")).toHaveCount(0);
  await manualDraft.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() => (window as unknown as { releaseLocation: () => void }).releaseLocation());
  expect((await request).postDataJSON()).toMatchObject({ latitude: 54.1, longitude: 10.2 });
  await expect(draft.locator('[data-loading-field="latitude"] .smart-field-spinner')).toHaveCount(0);
  await expect(draft.locator('[data-loading-field="temperature"] .smart-field-spinner')).toBeVisible();
  releaseWeather();
  if (format === "DD (") {
    await expect(draft.getByLabel("Lat", { exact: true })).toHaveValue("54.1");
    await expect(draft.getByLabel("Lon", { exact: true })).toHaveValue("10.2");
  } else {
    await expect(draft.getByLabel("Lat degrees", { exact: true })).toHaveValue("54");
    await expect(draft.getByLabel("Lon degrees", { exact: true })).toHaveValue("10");
    const minutes = format === "DDM (" ? "decimal minutes" : "minutes";
    await expect(draft.getByLabel(`Lat ${minutes}`, { exact: true })).toHaveValue(format === "DDM (" ? "6.0000" : "6");
    await expect(draft.getByLabel(`Lon ${minutes}`, { exact: true })).toHaveValue(format === "DDM (" ? "12.0000" : "12");
    if (format === "DMS (") {
      await expect(draft.getByLabel("Lat seconds", { exact: true })).toHaveValue("0.00");
      await expect(draft.getByLabel("Lon seconds", { exact: true })).toHaveValue("0.00");
    }
  }
  await expect(draft.locator('[data-line-field="temperature"]')).toHaveValue("21");
  await expect(draft.locator('[data-loading-field="temperature"] .smart-field-spinner')).toHaveCount(0);
  await expect(draft.locator('[data-line-field="barometer"]')).toHaveValue("1014");
  await expect(draft.getByLabel("Weather remark", { exact: true })).toHaveValue(/Weather data by Open-Meteo.com.*CC BY 4.0/);
  await expect(page.locator(".weather-data-attribution").first().getByRole("link", { name: "Weather data by Open-Meteo.com" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add smart line", exact: true })).toBeEnabled({ timeout: 40_000 });
  await expect(draft.locator(".smart-field-spinner")).toHaveCount(0);
  await expect(page.getByText("The line is ready, but some location or weather fields could not be filled automatically.", { exact: true })).toHaveCount(0);
});

test("weather-source links escape a one-line table and stay inside desktop and mobile viewports", async ({ page, context }) => {
  await page.route(/^https:\/\/(?:tile\.openstreetmap\.org|tiles\.openseamap\.org)\//, route => route.fulfill({ status: 204 }));
  await context.route("https://open-meteo.com/", route => route.fulfill({ contentType: "text/html", body: "Weather source" }));
  await loginWithSeededDemoData(page);
  const data = { boats: sampleBoats, crewMembers: crewProfilesFromSheets(sampleLogSheets), sheets: structuredClone(sampleLogSheets) };
  data.sheets[0].lines = [{ ...data.sheets[0].lines[0], weatherRemark: "Temperature from Open-Meteo. Weather data by Open-Meteo.com (https://open-meteo.com/), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Values converted, rounded or adapted for this logbook." }];
  const seeded = await page.request.put("/api/logbook/import", {
    headers: { Origin: "http://127.0.0.1:3000", "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook" }, data,
  });
  expect(seeded.ok(), await seeded.text()).toBeTruthy();
  await page.reload();
  await openModule(page, "Logsheet list", "+ New sheet");
  await page.getByRole("link", { name: demoSheet.title }).click();
  const trigger = page.getByRole("button", { name: /^Weather remark:/ });
  const bubble = page.getByRole("dialog", { name: "Weather remark", exact: true });
  for (const viewport of [{ width: 1280, height: 720 }, { width: 375, height: 640 }]) {
    await page.setViewportSize(viewport);
    await trigger.click();
    await expect(bubble).toBeVisible();
    expect(await bubble.evaluate(element => element.closest(".table-scroll"))).toBeNull();
    await expect(async () => {
      const bounds = await bubble.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    }).toPass();
    await expect(bubble.getByRole("link", { name: "Weather data by Open-Meteo.com", exact: true })).toHaveAttribute("href", "https://open-meteo.com/");
    await expect(bubble.getByRole("link", { name: "CC BY 4.0", exact: true })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
    await page.keyboard.press("Escape");
    await expect(bubble).toHaveCount(0);
  }
  await trigger.click();
  const opened = page.waitForEvent("popup");
  await bubble.getByRole("link", { name: "Weather data by Open-Meteo.com", exact: true }).click();
  const source = await opened;
  await expect(source).toHaveURL("https://open-meteo.com/");
  await source.close();
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
