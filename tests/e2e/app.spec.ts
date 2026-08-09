import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/health", (route) => route.fulfill({ json: { ok: true, data: { status: "ok", version: "v1" } } }));
  await page.route("**/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown;
    if (path === "/v1/openalex-subfields") data = { subfields: [{ id: "3107", displayName: "Optics", field: { id: "31", displayName: "Physics and Astronomy" }, domain: { id: "3", displayName: "Physical Sciences" } }] };
    else if (path === "/v1/openalex-subfield-sources") data = { sources: [{ id: "S1", displayName: "Optics Express", issnL: "1094-4087", issns: ["1094-4087"], type: "journal", worksCount: 1000 }], nextCursor: null };
    else if (path === "/v1/group-primary-topics") data = { meta: { documentCount: 100, nextCursor: null }, groups: [{ id: "T1", displayName: "Metasurfaces", count: 60 }, { id: "T2", displayName: "Integrated photonics", count: 40 }] };
    else if (path === "/v1/topic-details") data = { topics: ["T1", "T2"].map((id, index) => ({ id, displayName: index ? "Integrated photonics" : "Metasurfaces", description: "Fixture", keywords: ["optics"], subfield: { id: "sub1", displayName: "Optics" }, field: { id: "field1", displayName: "Physics" }, domain: { id: "domain1", displayName: "Physical Sciences" } })) };
    else if (path === "/v1/group-category-years") data = { meta: { documentCount: 300, nextCursor: null }, groups: [2020, 2021, 2022, 2023, 2024].map((year) => ({ id: String(year), displayName: String(year), count: 100 })) };
    else if (path === "/v1/group-topic-years") data = { meta: { documentCount: 100, nextCursor: null }, groups: [2020, 2021, 2022, 2023, 2024].map((year, index) => ({ id: String(year), displayName: String(year), count: 20 + index * 5 })) };
    else if (path === "/v1/group-sources") data = { meta: { documentCount: 100, nextCursor: null }, groups: [{ id: "S1", displayName: "Optics Express", count: 100 }] };
    else if (path === "/v1/group-topic-cooccurrence") data = { meta: { documentCount: 60, nextCursor: null }, groups: [{ id: "T2", displayName: "Integrated photonics", count: 20 }] };
    else throw new Error(`Unhandled mock route ${path}`);
    await route.fulfill({ json: { ok: true, data } });
  });
});

test("runs the shareable analysis workflow under a project base path", async ({ page }) => {
  await page.goto("?category=3107&year=2024&types=article,review&tab=overview&nodes=20");
  await expect(page.getByRole("heading", { name: "Explore an OpenAlex research subfield" })).toBeVisible();
  await page.getByLabel("Choose JIF JSON").setInputFiles({
    name: "jif-2026-local.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: 1,
      provider: "Clarivate",
      metric: "Journal Impact Factor",
      edition: "2026",
      sourceNote: "Local E2E fixture",
      journals: [{ journalName: "Optics Express", eissn: "1094-4087", index: "SCIE", citations: 100, jif: 4.8, previousJif: 4.6, quartile: "Q1", edition: "2026", provider: "Clarivate" }],
    })),
  });
  await expect(page.getByText(/1 journal records/)).toBeVisible();
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByRole("heading", { name: "Optics · 2024" })).toBeVisible();
  await expect(page.getByText("Metasurfaces", { exact: true }).first()).toBeVisible();
  await expect(page).toHaveURL(/category=3107.*year=2024/);

  const rankingDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).first().click();
  expect((await rankingDownload).suggestedFilename()).toBe("optics-2024-topic-ranking.csv");

  await page.getByRole("tab", { name: "Trends" }).click();
  await expect(page.getByRole("heading", { name: "Topic trends" })).toBeVisible();
  await page.getByRole("tab", { name: "Journals" }).click();
  await expect(page.getByText("Optics Express", { exact: true }).last()).toBeVisible();
  await expect(page.locator('td[data-label="JIF"]')).toHaveText("4.8");
  await page.getByRole("tab", { name: "Network" }).click();
  await page.getByRole("button", { name: "Generate network" }).click();
  await expect(page.locator(".vosviewer-frame")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Download JSON" })).toBeVisible();
});

test("keeps the core workflow usable at 320 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("?category=3107&year=2024");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByRole("heading", { name: "Optics · 2024" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
