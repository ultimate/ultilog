import { expect, test, type Page } from "@playwright/test";
import type { PersistedLogbook } from "../../app/models/logbook";

test.setTimeout(120_000);

async function login(page: Page) {
  await page.addInitScript(() => localStorage.setItem("ultilog-cookie-notice-acknowledged", "true"));
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  return (await (await page.request.get("/api/logbook")).json()) as PersistedLogbook;
}

async function openModule(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
}

async function openSheetFromList(page: Page, title: string) {
  await openModule(page, "Logsheet list");
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.locator("#sheet-title")).toHaveText(title);
}

test("new boat and crew forms have their own routes, related records and actions", async ({ page }) => {
  const data = await login(page);
  await openModule(page, "Boat manager");
  await page.locator(".manager-list button").first().click();
  await expect(page.getByText(/This boat cannot be deleted/)).toBeVisible();
  const selectedBoatName = await page.getByLabel("Name", { exact: true }).inputValue();
  await page.locator('.list-search input').fill(selectedBoatName);
  await page.getByRole("button", { name: "New boat", exact: true }).click();
  await expect(page.locator('.list-search input')).toHaveValue(selectedBoatName);
  await expect(page).toHaveURL(/\/boats\/new$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await expect(page.locator(".info-card .stack-list li")).toHaveCount(0);
  for (const action of ["Archive boat", "Restore boat", "Delete boat", "View logsheets"]) {
    await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  }
  await expect(page.getByText(/This boat cannot be deleted/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await page.goBack();
  await expect(page.getByRole("button", { name: "Save boat", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("button", { name: "Create boat", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/boats$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);

  await openModule(page, "Crew manager");
  await page.locator(".manager-list button").first().click();
  const name = await page.getByLabel("Name", { exact: true }).inputValue();
  await page.getByRole("button", { name: "New crew", exact: true }).click();
  await expect(page).toHaveURL(/\/crew\/new$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await expect(page.locator(".info-card .stack-list li")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
  await page.goForward();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/crew$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);

  for (const path of ["/boats/missing", "/crew/missing", "/crew/1junk"]) {
    await page.goto(path);
    await expect(page.getByText("Please select an entry")).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  }
  expect((await (await page.request.get("/api/logbook")).json()).boats).toHaveLength(data.boats.length);
});

test("cancel and browser history always reopen the complete existing logsheet", async ({ page }) => {
  const { sheets } = await login(page);
  await openSheetFromList(page, sheets[0].title);
  for (let attempt = 0; attempt < 2; attempt++) {
    await openModule(page, "Logsheet list");
    await page.getByRole("button", { name: "+ New sheet", exact: true }).click();
    await expect(page).toHaveURL(/\/details\/new$/);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("");
    await expect(page.locator(".log-lines-table")).toHaveCount(0);
    if (attempt === 0) await page.getByRole("button", { name: "Cancel", exact: true }).click();
    else await page.goBack();
    await expect(page.getByRole("button", { name: "+ New sheet", exact: true })).toBeVisible();
    await page.getByRole("link", { name: sheets[1].title, exact: true }).click();
    await expect(page.locator("#sheet-title")).toHaveText(sheets[1].title);
    await expect(page.locator(".log-lines-table")).toBeVisible();
    await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
  }
  await openModule(page, "Logsheet list");
  await page.getByRole("button", { name: "+ New sheet", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/details/missing");
  await expect(page.locator(".log-lines-table")).toHaveCount(0);
  await expect(page.locator("#sheet-title")).toHaveCount(0);
});

test("line and technical drafts stay with their sheet through adjacent, list and history navigation", async ({ page }) => {
  const { sheets } = await login(page);
  await page.goto(`/details/${sheets[0].id}`);
  await expect(page.locator("#sheet-title")).toHaveText(sheets[0].title);
  await page.getByRole("button", { name: "+ Add line", exact: true }).click();
  const editor = page.locator(".inline-line-row");
  await editor.locator('input[type="datetime-local"]').fill("2026-11-09T12:00");
  await editor.getByRole("textbox", { name: "Lat", exact: true }).fill("38.5");
  await editor.getByRole("textbox", { name: "Lon", exact: true }).fill("20.5");
  await page.getByRole("combobox", { name: "New technical log entry", exact: true }).fill("Draft for sheet A");
  await page.getByRole("button", { name: "Next log sheet", exact: true }).click();
  await expect(page.locator("#sheet-title")).toHaveText(sheets[1].title);
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "New technical log entry", exact: true })).toHaveValue("");
  await page.goBack();
  await expect(page.locator("#sheet-title")).toHaveText(sheets[0].title);
  await expect(editor).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "New technical log entry", exact: true })).toHaveValue("Draft for sheet A");
  await page.goForward();
  await expect(page.locator("#sheet-title")).toHaveText(sheets[1].title);
  await expect(editor).toHaveCount(0);
  await openSheetFromList(page, sheets[0].title);
  await expect(editor).toHaveCount(1);
  const saved = page.waitForResponse(response => response.url().endsWith(`/sheets/${sheets[0].id}/lines`) && response.request().method() === "POST");
  await editor.getByRole("button", { name: "Save line", exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
  await expect(editor).toHaveCount(0);
  await expect.poll(async () => {
    const stored = (await (await page.request.get("/api/logbook")).json()) as PersistedLogbook;
    return stored.sheets.find(sheet => sheet.id === sheets[0].id)?.lines.length;
  }).toBe(sheets[0].lines.length + 1);
  const stored = (await (await page.request.get("/api/logbook")).json()) as PersistedLogbook;
  expect(stored.sheets.find(sheet => sheet.id === sheets[1].id)?.lines).toHaveLength(sheets[1].lines.length);
});

test("repeated creation saves separate new entities and does not modify the previous selection", async ({ page }) => {
  const original = await login(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await openModule(page, "Boat manager");
    await page.getByRole("button", { name: "New boat", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
    await page.getByLabel("Name", { exact: true }).fill(`Fresh boat ${attempt}`);
    const boatSave = page.waitForResponse(response => response.url().endsWith("/api/logbook/boats") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Create boat", exact: true }).click();
    expect((await boatSave).ok()).toBeTruthy();
    await expect(page.getByRole("button", { name: "Save boat", exact: true })).toBeVisible();
    await openModule(page, "Crew manager");
    await page.getByRole("button", { name: "New crew", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
    await page.getByLabel("Name", { exact: true }).fill(`Fresh crew ${attempt}`);
    const crewSave = page.waitForResponse(response => response.url().endsWith("/api/logbook/crew") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Save crew", exact: true }).click();
    expect((await crewSave).ok()).toBeTruthy();
    await expect(page).not.toHaveURL(/\/new$/);
  }
  const stored = (await (await page.request.get("/api/logbook")).json()) as PersistedLogbook;
  expect(stored.boats).toHaveLength(original.boats.length + 2);
  expect(stored.crewMembers).toHaveLength(original.crewMembers.length + 2);
  for (const boat of original.boats) expect(stored.boats.find(candidate => candidate.id === boat.id)).toEqual(boat);
  for (const crew of original.crewMembers) expect(stored.crewMembers.find(candidate => candidate.id === crew.id)).toEqual(crew);
});

async function loginWithUploads(page: Page) {
  const { sampleBoats, sampleLogSheets } = await import("../fixtures/logbook");
  await page.addInitScript(() => localStorage.setItem("ultilog-cookie-notice-acknowledged", "true"));
  const email = `form-navigation-${Date.now()}@example.test`;
  const password = "correct horse battery staple";
  const registration = await page.request.post("/api/register", { data: { name: `Form navigation ${Date.now()}`, email, password } });
  expect(registration.ok(), await registration.text()).toBeTruthy();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("button", { name: "Continue to app", exact: true }).click();
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
  const crewMembers = sampleLogSheets.flatMap(sheet => sheet.crew)
    .filter((crew, index, all) => all.findIndex(candidate => candidate.id === crew.id) === index)
    .map(({ embarkationDateTime: _a, embarkationPosition: _b, disembarkationDateTime: _c, disembarkationPosition: _d, ...crew }) => crew);
  const imported = await page.request.put("/api/logbook/import", {
    headers: { Origin: "http://127.0.0.1:3000", "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook" },
    data: { boats: sampleBoats, sheets: sampleLogSheets, crewMembers },
  });
  expect(imported.ok(), await imported.text()).toBeTruthy();
  return { boats: sampleBoats, sheets: sampleLogSheets, crewMembers };
}

test("late image uploads cannot populate another boat, crew or logsheet form", async ({ page }) => {
  const data = await loginWithUploads(page);
  const imageBytes = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 8;
    canvas.getContext("2d")!.fillRect(0, 0, 8, 8);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const image = { name: "picture.png", mimeType: "image/png", buffer: Buffer.from(imageBytes, "base64") };
  for (const [newPath, existingPath] of [
    ["/boats/new", `/boats/${data.boats[0].id}`],
    ["/crew/new", `/crew/${data.crewMembers[0].id}`],
    ["/details/new", `/details/${data.sheets[0].id}`],
  ]) {
    await page.goto(newPath);
    await expect(page.locator('form input[type="file"]')).toHaveCount(1);
    let release!: () => void;
    let started!: () => void;
    let finished!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const uploading = new Promise<void>(resolve => { started = resolve; });
    const completed = new Promise<void>(resolve => { finished = resolve; });
    await page.route("**/api/images", async route => {
      started();
      const response = await route.fetch();
      await held;
      await route.fulfill({ response });
      finished();
    });
    try {
      await page.locator('form input[type="file"]').setInputFiles(image);
      await uploading;
      // Use in-app navigation so the old async handler really remains alive.
      if (newPath.startsWith("/boats")) await page.locator(".manager-list button").filter({ hasText: data.boats[0].name }).click();
      else if (newPath.startsWith("/crew")) await page.locator(".manager-list button").filter({ hasText: data.crewMembers[0].name }).click();
      else await openSheetFromList(page, data.sheets[0].title);
      await expect(page).toHaveURL(new RegExp(existingPath + "$"));
      // Open a new editor session before delivering the old upload response.
      if (newPath.startsWith("/boats")) await page.getByRole("button", { name: "New boat", exact: true }).click();
      else if (newPath.startsWith("/crew")) await page.getByRole("button", { name: "New crew", exact: true }).click();
      else {
        await openModule(page, "Logsheet list");
        await page.getByRole("button", { name: "+ New sheet", exact: true }).click();
      }
      const delivered = page.waitForResponse(response => response.url().endsWith("/api/images"));
      release();
      await completed;
      await (await delivered).finished();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.unroute("**/api/images");
      await expect(page.locator("form .entity-image img")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Remove image", exact: true })).toHaveCount(0);
    } finally {
      release();
      await page.unroute("**/api/images");
    }
  }
});

test("a late save completes for its original entity without replacing the newly opened form", async ({ page }) => {
  const { boats } = await login(page);
  await page.goto(`/boats/${boats[0].id}`);
  await page.getByLabel("Owner", { exact: true }).fill("Saved owner for A");
  let release!: () => void;
  let started!: () => void;
  let finished!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const saving = new Promise<void>(resolve => { started = resolve; });
  const completed = new Promise<void>(resolve => { finished = resolve; });
  await page.route(`**/api/logbook/boats/${boats[0].id}`, async route => {
    started();
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
    finished();
  });
  try {
    await page.getByRole("button", { name: "Save boat", exact: true }).click();
    await saving;
    await page.locator(".manager-list button").filter({ hasText: boats[1].name }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(boats[1].name);
    await page.getByLabel("Owner", { exact: true }).fill("Unsaved owner for B");
    release();
    await completed;
    await expect(page.getByLabel("Owner", { exact: true })).toHaveValue("Unsaved owner for B");
    await expect(page).toHaveURL(new RegExp(`/boats/${boats[1].id}$`));
    const stored = (await (await page.request.get("/api/logbook")).json()) as PersistedLogbook;
    expect(stored.boats.find(boat => boat.id === boats[0].id)?.owner).toBe("Saved owner for A");
    expect(stored.boats.find(boat => boat.id === boats[1].id)?.owner).toBe(boats[1].owner);
  } finally { release(); }
});
