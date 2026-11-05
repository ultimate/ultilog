import { expect, test } from "@playwright/test";

test("publishes notices and data credits without authentication", async ({ page }) => {
  await page.goto("/legal");
  await expect(page.getByText("Ultilog is currently operated as a non-commercial website.")).toBeVisible();
  await page.getByRole("link", { name: "Software licenses, source information, and weather and map credits" }).click();
  await expect(page.getByRole("heading", { name: "Third-party licenses and data credits" })).toBeVisible();
  const notices = await page.request.get("/legal/third-party-notices.txt");
  expect(notices.status()).toBe(200);
  const text = await notices.text();
  expect(text).toContain("Ultilog — browser software notices");
});
