import { expect, type Page, test } from "@playwright/test";
import { defaultWindDriftTable } from "../../app/models/boat";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

const targetSheet = sampleLogSheets[0];
test("edits technical log entries and suggests previous checks", async ({ page }) => {
  await loginWithSeededDemoData(page);
  await page.goto(`/details/${targetSheet.id}`);

  await expect(page.getByRole("heading", { name: targetSheet.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checks", level: 4 })).toBeVisible();
  await expect(page.getByText("08-12: Luca / Jonas")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Technical log entry 1" })).toHaveValue("Engine oil checked");
  await expect(page.locator('datalist#technical-log-suggestions option[value="Fuel valves open"]')).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "Check status 1" })).toHaveValue("⌛");
  await page.getByRole("textbox", { name: "Main engine Beginning of sheet" }).fill("120.5");
  await page.getByRole("textbox", { name: "Main engine End of sheet" }).fill("121.5");
  await page.getByRole("textbox", { name: "Main engine End of sheet" }).blur();
  await expect(page.getByRole("row", { name: /Counter difference/ })).toContainText("01:00");
  await expect(page.getByRole("row", { name: /Runtime tracked on sheet/ })).toContainText("01:00");
  await expect.poll(async () => {
    const stored = await (await page.request.get("/api/logbook")).json();
    return stored.sheets.find((sheet: { id: string }) => sheet.id === targetSheet.id)?.engineHourCounters?.["main-engine"];
  }).toEqual({ start: 120.5, end: 121.5 });
  await expect(page.getByText("Unable to save the latest changes. Please try again.")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Main engine Beginning of sheet" })).toHaveValue("120:30");
  await expect(page.getByRole("textbox", { name: "Main engine End of sheet" })).toHaveValue("121:30");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".engine-hour-counter-section .table-scroll").scrollIntoViewIfNeeded();
  await expect(page.locator(".engine-hour-counter-section .table-scroll")).toBeInViewport();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("combobox", { name: "Check status 1" }).selectOption("✅");
  await expect(page.getByRole("combobox", { name: "Check status 1" })).toHaveValue("✅");

  await page.getByRole("combobox", { name: "New technical log entry" }).fill("✅ Generator belt inspected");
  await page.getByRole("button", { name: "Add technical log entry" }).click();
  await expect(page.getByRole("combobox", { name: "Technical log entry 6" })).toHaveValue("✅ Generator belt inspected");

  await page.getByRole("combobox", { name: "Technical log entry 6" }).fill("⚠️ Generator belt recheck tomorrow");
  await page.getByRole("button", { name: "Save Technical log entry 6" }).click();
  await expect(page.getByRole("combobox", { name: "Technical log entry 6" })).toHaveValue("⚠️ Generator belt recheck tomorrow");

  await page.getByRole("button", { name: "Delete technical log entry 6" }).click();
  await expect(page.getByRole("combobox", { name: "Technical log entry 6" })).toHaveCount(0);

  await page.getByRole("button", { name: "Lock log sheet" }).click();
  await expect(page.getByRole("combobox", { name: "Technical log entry 1" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "New technical log entry" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete technical log entry 1" })).toBeDisabled();

  const motorSheet = sampleLogSheets[1];
  await page.goto(`/details/${motorSheet.id}`);
  const firstLine = page.locator(".log-lines-table tbody tr").first();
  await firstLine.getByRole("button", { name: "✏️" }).click();
  await page.getByRole("textbox", { name: "Port engine Engine runtime increment" }).fill("0.5");
  await page.getByRole("textbox", { name: "Starboard engine Engine runtime increment" }).fill("0.6");
  await firstLine.getByRole("button", { name: "💾" }).click();
  await expect.poll(async () => {
    const stored = await (await page.request.get("/api/logbook")).json();
    return stored.sheets.find((sheet: { id: string }) => sheet.id === motorSheet.id)?.lines[0]?.engineHours;
  }).toEqual({ "port-engine": 0.5, "starboard-engine": 0.6 });
  await expect(page.getByText("Unable to save the latest changes. Please try again.")).toHaveCount(0);
});

test("preserves partially typed preference-formatted date and time", async ({ page }) => {
  await loginWithSeededDemoData(page);
  await page.goto(`/details/${targetSheet.id}`);
  const row = page.locator(".log-lines-table tbody tr").first();
  await row.getByRole("button", { name: "✏️" }).click();
  const time = row.getByRole("textbox", { name: "Log line date and time" });
  await page.setViewportSize({ width: 2560, height: 1440 });
  const showCourses = page.getByRole("button", { name: "Show course conversion columns", exact: true });
  if (await showCourses.count()) await showCourses.click();
  await expect.poll(() => page.locator(".log-lines-table").evaluate(table => table.parentElement!.scrollWidth - table.parentElement!.clientWidth)).toBeLessThanOrEqual(1);
  await time.fill("12/10/2026, 10:");
  await time.pressSequentially("45", { delay: 150 });
  await expect(time).toHaveValue("12/10/2026, 10:45");
  const weather = row.locator("td").nth(4).locator("option");
  await expect(weather).toHaveText(["—", "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌫️", "🌦️", "🌧️", "⛈️", "🌩️", "🌨️", "❄️", "🌪️", "⭐"]);
  await expect(row.locator('input[data-line-field="temperature"]')).toHaveAttribute("step", "1");
  await expect(page.locator(".course-tooltip-trigger")).toHaveCount(1);
  await page.locator(".course-tooltip-trigger").focus();
  await page.locator(".course-tooltip-trigger").press("Enter");
  await expect(page.getByRole("tooltip")).toContainText("Compass course");
  await expect(page.getByRole("tooltip")).toContainText("Course over ground");
  const checkTooltipAnchor = async () => {
    const icon = await page.locator(".course-tooltip-icon").boundingBox();
    const tooltip = await page.getByRole("tooltip").boundingBox();
    expect(icon).not.toBeNull();
    expect(tooltip).not.toBeNull();
    expect(Math.abs(tooltip!.y - (icon!.y + icon!.height + 8))).toBeLessThan(2);
    expect(Math.abs(tooltip!.x + tooltip!.width / 2 - (icon!.x + icon!.width / 2))).toBeLessThan(2);
  };
  await checkTooltipAnchor();
  // A delayed focus scroll must reposition the tooltip, not dismiss it.
  await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
  await expect(page.getByRole("tooltip")).toBeVisible();
  await checkTooltipAnchor();
  await page.locator(".course-tooltip-trigger").press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await row.getByRole("button", { name: "💾" }).click();
  await expect.poll(async () => {
    const stored = await (await page.request.get("/api/logbook")).json();
    return stored.sheets.find((sheet: { id: string }) => sheet.id === targetSheet.id)?.lines.find((line: { id: string }) => line.id === targetSheet.lines[0].id)?.time;
  }).toContain("2026-10-12T10:45");
  await page.reload();
  const savedRow = page.locator(".log-lines-table tbody tr").filter({ hasText: targetSheet.lines[0].weatherRemark });
  await expect.poll(() => page.locator(".log-lines-table").evaluate(table => table.parentElement!.scrollWidth - table.parentElement!.clientWidth)).toBeLessThanOrEqual(1);
  await savedRow.getByRole("button", { name: "✏️" }).click();
  await expect(page.locator(".inline-line-row").getByRole("textbox", { name: "Log line date and time" })).toHaveValue("12/10/2026, 10:45");
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
    data: { boats: sampleBoats.map(boat => ({ ...boat, windDriftTable: defaultWindDriftTable() })), crewMembers: crewProfilesFromSheets(sampleLogSheets), sheets: sampleLogSheets.map(sheet => ({ ...sheet, lines: sheet.lines.map(line => ({ ...line, time: `${line.time}+00:00` })) })) },
  });
  expect(seedResponse.ok(), await seedResponse.text()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
}

async function removeDemoLogsheets(page: Page) {
  const currentResponse = await page.request.get("/api/logbook");
  expect(currentResponse.ok()).toBeTruthy();
  const currentLogbook = await currentResponse.json();
  // Clear the sheets atomically before replacing demo boat IDs. Individual
  // deletes can race the client's queued normalization saves after login.
  const clearResponse = await page.request.put("/api/logbook/import", { headers: { Origin: "http://127.0.0.1:3000", "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook" }, data: { ...currentLogbook, sheets: [] } });
  expect(clearResponse.ok(), await clearResponse.text()).toBeTruthy();
  await expect.poll(async () => (await (await page.request.get("/api/logbook")).json()).sheets.length).toBe(0);
}

function crewProfilesFromSheets(sheets: typeof sampleLogSheets) {
  return sheets.flatMap((sheet) => sheet.crew).filter((crew, index, crews) => crews.findIndex((candidate) => candidate.id === crew.id) === index).map(({ embarkationDateTime, embarkationPosition, disembarkationDateTime, disembarkationPosition, ...crew }) => crew);
}
