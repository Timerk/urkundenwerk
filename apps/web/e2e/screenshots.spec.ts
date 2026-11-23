import { expect, test } from "@playwright/test";
import { NORD_DRAFT, signIn } from "./helpers";

// Refreshes the README screenshots in docs/screenshots. Run it against a
// freshly seeded database: `pnpm db:reset`, then
// `SCREENSHOTS=1 pnpm test:e2e e2e/screenshots.spec.ts`.
test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to refresh them.");
test.use({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});

const target = (name: string) => `../../docs/screenshots/${name}.png`;

test("landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("figure")).toContainText("fünfundzwanzigtausend");
  await page.screenshot({ path: target("landing") });
});

test("dashboard and builder", async ({ page }) => {
  await signIn(page, "erik.editor@demo.test");

  // A second, unfinished draft shows the readiness column at work.
  await page.getByRole("button", { name: "New Musterprotokoll" }).click();
  await expect(page.locator("[data-builder-ready]")).toBeAttached();
  await page
    .getByRole("textbox", { name: "Firma (company name)", exact: true })
    .fill("Hafenmuster Analytics UG (haftungsbeschränkt)");
  await page
    .getByRole("textbox", { name: "Stammkapital (share capital)" })
    .fill("5.000");
  await expect(
    page.getByRole("textbox", { name: "Document title" }),
  ).toHaveValue("Hafenmuster Analytics UG (haftungsbeschränkt)");
  await expect(page.getByRole("status").getByText(/^Saved at/)).toBeVisible();

  await page.goto("/app");
  await expect(page.getByRole("row")).toHaveCount(3);
  await page.setViewportSize({ width: 1440, height: 560 });
  await page.screenshot({ path: target("dashboard") });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`/app/documents/${NORD_DRAFT}`);
  await expect(page.locator("[data-builder-ready]")).toBeAttached();
  // Focus the Firma without scrolling, so the preview marks its values.
  await page.evaluate(() =>
    document
      .querySelector<HTMLInputElement>("#field-company-name")
      ?.focus({ preventScroll: true }),
  );
  await page.screenshot({ path: target("builder") });
});
