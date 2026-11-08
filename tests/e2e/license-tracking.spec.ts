import { expect, test } from "@playwright/test";

for (const dateFormat of ["dd/MM/yyyy", "yyyy-MM-dd"]) {
  test(`edits and persists the license start year using ${dateFormat}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Try the demo" }).click();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 30_000 });
    const headers = { Origin: "http://127.0.0.1:3000" };
    const preferences = await page.request.patch("/api/profile", { headers, data: { action: "preferences", preferences: { dateFormat } } });
    expect(preferences.ok(), await preferences.text()).toBeTruthy();
    const selected = await page.request.patch("/api/compliance", { headers, data: { action: "select-license", licenseId: "ch-hochseeausweis-sail", selected: true } });
    expect(selected.ok(), await selected.text()).toBeTruthy();
    const logbook = await (await page.request.get("/api/logbook")).json();
    expect(logbook.boats.every((boat: { type: string }) => ["sail", "motor"].includes(boat.type))).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Compliance", exact: true }).click();
    const input = page.locator('input[type="text"][id="license-start-ch-hochseeausweis-sail"]');
    await expect(input).toBeVisible();
    const saves: string[] = [];
    page.on("request", request => {
      if (request.url().endsWith("/api/compliance") && request.method() === "PATCH") saves.push(request.postData() ?? "");
    });
    const date = dateFormat === "yyyy-MM-dd" ? "2026-04-02" : "02/04/2026";
    await input.pressSequentially(date);
    await expect(input).toBeFocused();
    expect(saves).toHaveLength(0);
    await input.press("Enter");
    await expect.poll(async () => (await (await page.request.get("/api/compliance")).json()).licenses[0].startDate).toBe("2026-04-02");
    await expect(input).toBeEnabled();
    await input.fill(dateFormat === "yyyy-MM-dd" ? "2025-04-02" : "02/04/2025");
    await input.press("Tab");
    await expect.poll(async () => (await (await page.request.get("/api/compliance")).json()).licenses[0].startDate).toBe("2025-04-02");
    await page.reload();
    await expect(input).toHaveValue(dateFormat === "yyyy-MM-dd" ? "2025-04-02" : "02/04/2025");
    await input.fill("invalid");
    await input.press("Tab");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await input.fill("");
    await input.press("Tab");
    await expect.poll(async () => (await (await page.request.get("/api/compliance")).json()).licenses[0].startDate).toBeNull();
    const picker = page.locator('input[type="date"]').first();
    await picker.fill("2024-03-01");
    await picker.press("Enter");
    await expect.poll(async () => (await (await page.request.get("/api/compliance")).json()).licenses[0].startDate).toBe("2024-03-01");
  });
}
