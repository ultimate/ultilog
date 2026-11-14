import { expect, test, type Page } from "@playwright/test";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";
const origin = "http://127.0.0.1:3000";
const headers = {
  Origin: origin,
  "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook",
};
async function seed(page: Page) {
  await page.route(
    /^https:\/\/(?:tile\.openstreetmap\.org|tiles\.openseamap\.org)\//,
    (route) => route.fulfill({ status: 204 }),
  );
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({
    timeout: 30000,
  });
  const existing = await (await page.request.get("/api/logbook")).json();
  expect(
    (
      await page.request.put("/api/logbook/import", {
        headers,
        data: { ...existing, sheets: [] },
      })
    ).ok(),
  ).toBe(true);
  const crew = (id: string, from: string, to: string) => ({
    id,
    name: id,
    nationality: "",
    role: "",
    embarkationDateTime: from,
    disembarkationDateTime: to,
    embarkationPosition: "",
    disembarkationPosition: "",
  });
  const at = (time: string) => `2026-07-12T${time}:00Z`;
  const sheet = {
    ...sampleLogSheets[0],
    id: "changeover",
    title: "Respocean - Kroatien",
    boatId: sampleBoats[0].id,
    route: {
      from: "Split",
      to: "Split",
      departed: at("08:00"),
      arrived: at("18:00"),
    },
    crew: [
      crew("Skipper", at("08:00"), at("18:00")),
      crew("Old crew", at("08:00"), at("15:35")),
      crew("New crew", at("15:35"), at("18:00")),
    ],
    lines: [
      {
        ...sampleLogSheets[0].lines[0],
        id: "first",
        time: at("08:00"),
        logNm: 0,
        sailMiles: 0,
        motorMiles: 0,
      },
      {
        ...sampleLogSheets[0].lines[0],
        id: "handover",
        time: at("15:35"),
        logNm: 30,
        sailMiles: 30,
        motorMiles: 0,
      },
      {
        ...sampleLogSheets[0].lines[0],
        id: "last",
        time: at("18:00"),
        logNm: 40,
        sailMiles: 10,
        motorMiles: 0,
      },
    ],
  };
  const response = await page.request.put("/api/logbook/import", {
    headers,
    data: { boats: sampleBoats, crewMembers: sheet.crew, sheets: [sheet] },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await page.goto("/turns");
  await expect(
    page.getByRole("heading", { name: "Turns", exact: true }),
  ).toBeVisible();
}

test("names, splits, filters and merges turns with a shared changeover sheet", async ({
  page,
}) => {
  await seed(page);
  await expect(
    page.getByText("Crew change: suggested split", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Turn name", { exact: true }).fill("My Croatia week");
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "My Croatia week", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Split at date and time", exact: true })
    .click();
  await page.getByLabel("Boundary time (UTC)").fill("2026-07-12T15:35");
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(
    page.getByText("Participating crew: Skipper, Old crew", { exact: true }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/logbook/turns")).json();
  expect(state.turns).toHaveLength(2);
  await page
    .getByRole("button", { name: "View logsheets", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Turns", exact: true }),
  ).toHaveValue(state.turns[0].id);
  await expect(page.getByText(/Partial sheet/).first()).toBeVisible();
  await page
    .getByRole("link", { name: "Respocean - Kroatien", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Logsheet list", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Turns", exact: true }),
  ).toHaveValue(state.turns[0].id);
  await page.goto("/crew/Skipper");
  await expect(
    page.getByText("Log sheets: 1 · Shared turns: 2", { exact: true }).last(),
  ).toBeVisible();
  await page.goto("/turns");
  await page
    .getByRole("button", { name: "Adjust start boundary", exact: true })
    .click();
  await page.getByLabel("Boundary time (UTC)").fill("2026-07-12T16:17");
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/logbook/turns")).json()).turns[1]
          .start,
    )
    .toBe("2026-07-12T16:17:00.000Z");
  await page
    .getByRole("button", { name: "Correct allocation", exact: true })
    .click();
  await page
    .getByRole("group", { name: "My Croatia week", exact: true })
    .getByRole("checkbox", { name: "New crew", exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/logbook/turns")).json())
          .corrections.length,
    )
    .toBe(1);
  await page.getByRole("button", { name: "All turns", exact: true }).click();
  await page
    .getByRole("button", { name: "Merge with next turn", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/logbook/turns")).json()).turns
          .length,
    )
    .toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "My Croatia week", exact: true }),
  ).toBeVisible();
});

test("unnamed and suggested names survive reload on a mobile viewport", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Turn name", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unnamed turn", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByRole("checkbox", { name: "Use suggested name" }).check();
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Respocean - Kroatien", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
