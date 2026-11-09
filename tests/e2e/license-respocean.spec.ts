import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { LogSheetsRepository } from "../../app/lib/repositories/log-sheets-repository";
import type { BoatRow, LogLineRow, LogSheetRow } from "../../app/models/logbook";

const load = <T,>(day: number, suffix: string): T[] => JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/logbook-scanner/real-world", `2026-07-${day}_Respocean_${suffix}.json`), "utf8"));

test("shows the actual Respocean voyage mileage for a March 7, 2026 theory exam", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
  const sheets = Array.from({ length: 6 }, (_, index) => load<LogSheetRow>(12 + index, "log_sheet")).flat();
  const lines = Array.from({ length: 6 }, (_, index) => load<LogLineRow>(12 + index, "log_lines")).flat();
  const boat = { id: sheets[0].boat_id, name: "Lazy Bone", type: "sail", registration: "", flag_state: "", home_port: "", owner: "", dimensions: "" } as BoatRow;
  const logbook = LogSheetsRepository.toLogbook([boat], sheets, [], lines);
  // Supply the captured account records through the real bootstrap response shape.
  await page.route("**/api/logbook", route => route.fulfill({ json: logbook }));
  await page.route("**/api/compliance", async route => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({ json: { licenses: [{ licenseId: "ch-hochseeausweis-sail", startDate: "2026-03-07", completedManualRequirementIds: [] }] } });
  });
  await page.reload();
  await page.getByRole("button", { name: "Compliance", exact: true }).click();
  for (const id of ["ch-7-a-2-1", "ch-7-a-2-2"]) {
    const row = page.locator(".requirement-row").filter({ has: page.locator(`#requirement-copy-${id}`) });
    await expect(row.locator(".requirement-progress dl > div:first-child dd")).toHaveText("215.9");
    await expect(row.getByRole("progressbar")).toBeVisible();
  }
});

test("counts a single motor-mileage entry toward add-on days at sea", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-09T12:00:00Z"));
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
  const logbook = await (await page.request.get("/api/logbook")).json();
  const voyage = logbook.sheets[0];
  const boat = logbook.boats.find((candidate: { id: string }) => candidate.id === voyage.boatId);
  boat.type = "motor";
  voyage.title = "Test";
  voyage.route.departed = "2026-11-06T08:00:00Z";
  voyage.route.arrived = "2026-11-07T10:00:00Z";
  voyage.lines = [{ ...voyage.lines[0], time: "2026-11-07T10:00:00Z", logNm: 0, sailMiles: 0, motorMiles: 27 }];
  logbook.sheets = [voyage];
  await page.route("**/api/logbook", route => route.fulfill({ json: logbook }));
  await page.route("**/api/compliance", async route => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({ json: { licenses: [{ licenseId: "ch-hochseeausweis-motor-addon", startDate: null, completedManualRequirementIds: [] }] } });
  });
  await page.reload();
  await page.getByRole("button", { name: "Compliance", exact: true }).click();
  const days = page.locator(".requirement-row").filter({ has: page.locator("#requirement-copy-ch-8-b-1") });
  await expect(days.locator(".requirement-progress dl > div:first-child dd")).toHaveText("1");
  const miles = page.locator(".requirement-row").filter({ has: page.locator("#requirement-copy-ch-8-b-2") });
  await expect(miles.locator(".requirement-progress dl > div:first-child dd")).toHaveText("27");
});
