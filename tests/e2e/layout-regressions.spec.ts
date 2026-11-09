import { expect, test, type Locator } from "@playwright/test";

async function expectInside(inner: Locator, outer: Locator) {
  const bounds = await outer.boundingBox();
  expect(bounds).not.toBeNull();
  for (const element of await inner.all()) {
    const box = await element.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(bounds!.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
  }
}

test("translated login content stays inside the card and both bottom bars remain reachable", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem("ultilog-cookie-notice-acknowledged", "true"));
  await page.goto("/login");
  for (const viewport of [{ width: 1920, height: 1030 }, { width: 1024, height: 600 }, { width: 390, height: 600 }]) {
    await page.setViewportSize(viewport);
    for (const locale of ["en", "de", "fr", "it"]) {
      await page.locator(".auth-locale-select select").selectOption(locale);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const card = page.locator(".landing-login .auth-card");
      await expectInside(card.locator("h1, input, select, button, .auth-footer"), card);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      for (const selector of [".partner-banner", ".public-legal-bar"]) {
        const bar = page.locator(selector);
        await bar.scrollIntoViewIfNeeded();
        await expect(bar).toBeInViewport({ ratio: .99 });
      }
      const layout = await page.locator(".landing-layout").boundingBox();
      const partner = await page.locator(".partner-banner").boundingBox();
      const legal = await page.locator(".public-legal-bar").boundingBox();
      expect(partner!.y).toBeGreaterThanOrEqual(layout!.y + layout!.height - 1);
      expect(legal!.y).toBeGreaterThanOrEqual(partner!.y + partner!.height - 1);
    }
  }
  // Larger text and a short viewport must grow the page, not crop its footer.
  await page.addStyleTag({ content: "html { font-size: 24px; }" });
  await page.locator(".auth-locale-select select").selectOption("de");
  await expectInside(page.locator(".auth-card").locator("h1, input, select, button, .auth-footer"), page.locator(".auth-card"));
  await page.locator(".public-legal-bar").scrollIntoViewIfNeeded();
  await expect(page.locator(".public-legal-bar")).toBeInViewport({ ratio: .99 });
});

test("desktop landing fits below browser bars without scrolling in every language", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("ultilog-cookie-notice-acknowledged", "true"));
  await page.goto("/login");
  // Full HD with browser/task bars, plus a common 125% display-scaling viewport.
  for (const viewport of [{ width: 1920, height: 960 }, { width: 1920, height: 900 }, { width: 1536, height: 760 }]) {
    await page.setViewportSize(viewport);
    for (const locale of ["en", "de", "fr", "it"]) {
      await page.locator(".auth-locale-select select").selectOption(locale);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
      expect(size.width, `${locale} at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(viewport.width);
      expect(size.height, `${locale} at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(viewport.height + 1);
      await expect(page.locator(".public-legal-bar")).toBeInViewport({ ratio: .99 });
      await expectInside(page.locator(".auth-card h1, .auth-card input, .auth-card select, .auth-card button, .auth-footer"), page.locator(".auth-card"));
    }
  }
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.locator(".auth-locale-select select").selectOption("de");
  await page.screenshot({ path: testInfo.outputPath("landing-full-hd-de.png") });
  // Larger text must remain accessible even when it requires a taller document.
  await page.addStyleTag({ content: "html { font-size: 24px; }" });
  await page.locator(".public-legal-bar").scrollIntoViewIfNeeded();
  await expect(page.locator(".public-legal-bar")).toBeInViewport({ ratio: .99 });
});

test("daily changelog keeps commit identifiers with their entries", async ({ page }) => {
  const entries = ["a", "b"].map((letter, index) => ({
    id: `fix-${letter}`, category: "fix", title: { en: `Layout fix ${letter}` },
    introduction: { commitSha: letter.repeat(40), shortSha: letter.repeat(7), introducedAt: `2026-10-03T${index ? "18" : "08"}:00:00.000Z` },
  }));
  await page.route("**/generated/changelog.json", route => route.fulfill({ json: entries }));
  await page.goto("/changelog");
  await expect(page.locator(".changelog-group")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "October 3, 2026" })).toBeVisible();
  for (const letter of ["a", "b"]) {
    const item = page.locator(".changelog-category li").filter({ hasText: `Layout fix ${letter}` });
    await expect(item.locator("code")).toHaveText(letter.repeat(7));
  }
});

test("navigation follows the dark palette across desktop, collapsed, and mobile layouts", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem("ultilog-cookie-notice-acknowledged", "true"));
  const email = `layout-${Date.now()}@example.test`;
  const password = "correct horse battery staple";
  const response = await page.request.post("/api/register", { data: { name: "Layout checks", email, password } });
  expect(response.ok()).toBeTruthy();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("button", { name: "Continue to app" }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
  // Use the actual theme control, including persisted preference handling.
  if (await page.locator(".app-shell").getAttribute("data-theme") !== "dark") await page.locator(".app-sidebar .theme-toggle").click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "dark");
  const navigation = page.locator(".app-sidebar .module-tabs button").first();
  await expect(navigation).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".app-sidebar .module-tabs button").nth(1)).toHaveCSS("color", "rgb(238, 246, 255)");
  const inactiveIconFilter = await page.locator(".app-sidebar .module-tabs button").nth(1).locator("img").evaluate(icon => getComputedStyle(icon).filter);
  const activeIconFilter = await navigation.locator("img").evaluate(icon => getComputedStyle(icon).filter);
  expect(inactiveIconFilter).not.toBe("none");
  expect(activeIconFilter).not.toBe(inactiveIconFilter);
  const whatsNew = page.locator(".changelog-navigation");
  await whatsNew.click();
  await expect(whatsNew).toHaveClass(/active/);
  await expect(page.getByRole("heading", { name: "What's new" })).toBeVisible();
  await whatsNew.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(whatsNew).toHaveCSS("outline-style", "solid");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(whatsNew.locator(".nav-label")).toBeHidden();
  await expect(whatsNew).toBeVisible();
  for (const viewport of [{ width: 390, height: 844 }, { width: 900, height: 500 }]) {
    await page.setViewportSize(viewport);
    const nav = page.locator(viewport.width === 390 ? ".mobile-bottom-nav" : ".app-sidebar");
    await expect(nav).toBeVisible();
    await expect(nav.locator("button").first()).toHaveCSS("color", "rgb(238, 246, 255)");
    await expect(nav.getByRole("button", { name: "Dashboard", exact: true }).locator("img")).toHaveCSS("filter", inactiveIconFilter);
    await nav.getByRole("button", { name: "Dashboard", exact: true }).press("Enter");
    await expect(nav.locator("button.active .tab-icon img")).toHaveCSS("filter", activeIconFilter);
    // Leave both navigation variants with an inactive Dashboard for the next size.
    if (viewport.width === 390) {
      await nav.locator(".mobile-theme-action").click();
      await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "light");
      await expect(nav.getByRole("button", { name: "Boat manager", exact: true }).locator("img")).toHaveCSS("filter", "none");
      await nav.locator(".mobile-theme-action").click();
    }
    await nav.getByRole("button", { name: "Boat manager", exact: true }).press("Enter");
  }
});
