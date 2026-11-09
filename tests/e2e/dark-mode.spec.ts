import { expect, test, type Page } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

async function expectReadable(page: Page, selector: string) {
  const results = await page.locator(selector).evaluateAll(elements => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    function paint(color: string) { context.fillStyle = color; context.fillRect(0, 0, 1, 1); }
    function luminance(rgb: number[]) {
      const channels = rgb.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      });
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    }
    return elements.filter(element => element.getBoundingClientRect().width && element.getBoundingClientRect().height).map(element => {
      const ancestors: Element[] = [];
      for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
      context.clearRect(0, 0, 1, 1);
      paint("white");
      for (const ancestor of ancestors) paint(getComputedStyle(ancestor).backgroundColor);
      const background = luminance([...context.getImageData(0, 0, 1, 1).data]);
      paint(getComputedStyle(element).color);
      const foreground = luminance([...context.getImageData(0, 0, 1, 1).data]);
      return { text: element.textContent?.trim().slice(0, 70), ratio: (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05) };
    });
  });
  expect(results.length, selector).toBeGreaterThan(0);
  expect(results.filter(result => result.ratio < 4.5), `Low-contrast text in ${selector}`).toEqual([]);
}

async function expectDarkSurfaces(page: Page, selector: string) {
  const bright = await page.locator(selector).evaluateAll(elements => elements.filter(element => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#071321";
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = getComputedStyle(element).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return r > 180 && g > 180 && b > 180;
  }).map(element => element.className));
  expect(bright, "Unexpected bright UI surfaces").toEqual([]);
}

test("dark mode covers page edges, keeps text readable, and themes cards, forms and dialogs", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem("ultilog-cookie-notice-acknowledged", "true"));
  await page.context().route(/^https:\/\//, route => route.abort());
  const email = `dark-audit-${Date.now()}@example.test`;
  const password = "correct horse battery staple";
  const registration = await page.request.post("/api/register", { data: { name: "Dark mode audit", email, password } });
  expect(registration.ok()).toBeTruthy();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("button", { name: "Continue to app" }).click();
  await expect(page.locator('.app-content[data-backend-ready="true"]')).toBeVisible();
  if (await page.locator(".app-shell").getAttribute("data-theme") !== "dark") await page.locator(".app-sidebar .theme-toggle").click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "dark");
  for (const viewport of [{ width: 390, height: 844 }, { width: 900, height: 500 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    const bounds = await page.locator(".app-shell").boundingBox();
    expect(bounds!.x).toBe(0);
    expect(bounds!.width).toBe(viewport.width);
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(7, 19, 33)");
    await expectReadable(page, ".page-heading h1, .page-heading p, .eyebrow, .onboarding-heading p, .onboarding-progress, .onboarding-task-list strong, .onboarding-task-list small, .onboarding-task-list em, .sync-pill, .dashboard-pie strong, .dashboard-pie span");
    await expectDarkSurfaces(page, ".onboarding-task-list li, .stat-grid article, .chart-card");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const dismissToast = page.locator(".toast-notification button");
  if (await dismissToast.isVisible()) await dismissToast.click();
  await page.screenshot({ path: testInfo.outputPath("dark-dashboard-portrait.png"), fullPage: false });
  // Both checked and unchecked onboarding cards must keep readable text.
  const task = page.locator(".onboarding-task-list li").filter({ hasText: "Read the compliance information for your country" });
  await task.locator('input[type="checkbox"]').check();
  await expect(task).toHaveClass(/complete/);
  await expectReadable(page, ".onboarding-task-list strong, .onboarding-task-list small, .onboarding-task-list em");
  await page.locator(".mobile-bottom-nav .mobile-theme-action").click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".onboarding-task-list li:not(.complete)").first()).toHaveCSS("background-color", "rgb(248, 251, 253)");
  await page.locator(".mobile-bottom-nav .mobile-theme-action").click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "dark");

  const crewMembers = sampleLogSheets.flatMap(sheet => sheet.crew).filter((crew, index, all) => all.findIndex(candidate => candidate.id === crew.id) === index).map(({ embarkationDateTime: _a, embarkationPosition: _b, disembarkationDateTime: _c, disembarkationPosition: _d, ...crew }) => crew);
  const seeded = await page.request.put("/api/logbook/import", { headers: { Origin: "http://127.0.0.1:3000", "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook" }, data: { boats: sampleBoats, crewMembers, sheets: sampleLogSheets } });
  expect(seeded.ok(), await seeded.text()).toBeTruthy();
  const selectedLicense = await page.request.patch("/api/compliance", { headers: { Origin: "http://127.0.0.1:3000" }, data: { action: "select-license", licenseId: "ch-hochseeausweis-sail", selected: true } });
  expect(selectedLicense.ok()).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of ["/boats", "/crew", "/logbooks", "/compliance", "/profile", `/details/${sampleLogSheets[0].id}`]) {
    await page.goto(path);
    await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "dark");
    await expectReadable(page, ".app-content h1, .app-content h2, .app-content h3, .app-content .eyebrow");
    await expectDarkSurfaces(page, ".form-card, .line-form, .onboarding-task-list li, .table-card, .sheet-card, .info-card");
    if (path === "/boats") {
      await page.getByRole("button", { name: "New boat", exact: true }).click();
      await expect(page.locator(".inline-edit-grid")).toBeVisible();
      await expectDarkSurfaces(page, ".info-card:has(.inline-edit-grid), .image-preview-frame");
      await expectReadable(page, ".inline-edit-grid .eyebrow, .inline-edit-grid label");
    }
    if (path === "/compliance") {
      await expect(page.locator(".license-status-pie").first()).toBeVisible();
      await expectReadable(page, ".license-status-pie strong, .license-status-legend dt, .license-status-legend dd");
    }
    if (path.startsWith("/details/")) {
      await expect(page.locator(".leaflet-container")).toBeVisible();
      await expectDarkSurfaces(page, ".leaflet-bar a, .leaflet-control-attribution");
      await expectReadable(page, ".paper-header span, .log-lines-table th, .log-lines-table td");
      await page.getByRole("button", { name: "Share log sheet", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectDarkSurfaces(page, ".share-logsheet-panel");
      await expectReadable(page, ".share-logsheet-panel h2, .share-logsheet-panel p, .share-logsheet-panel label");
    }
  }
});
