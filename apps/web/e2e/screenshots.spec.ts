import { join } from "node:path";
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
  await page
    .getByRole("button", { name: "Handelsregisteranmeldung", exact: true })
    .click();
  await expect(
    page
      .getByRole("article")
      .getByRole("heading", { name: "Handelsregisteranmeldung" }),
  ).toBeVisible();
  await page.screenshot({ path: target("register-filing") });
});

test("import review", async ({ page }) => {
  await signIn(page, "erik.editor@demo.test");
  await page.goto("/app/import");
  await page
    .getByLabel(/Drop a PDF or DOCX here/)
    .setInputFiles(
      join(
        __dirname,
        "../../../packages/extraction/eval/dev/11-musterprotokoll/document.pdf",
      ),
    );
  await expect(
    page.getByRole("heading", { name: "Review extracted values" }),
  ).toBeVisible();
  // Accept the notarisation values, then show the Firma and its passage.
  for (const label of ["Form of notarisation", "Deed number (UR. Nr.)"]) {
    await page
      .getByRole("listitem", { name: label, exact: true })
      .getByRole("radio", { name: "Accept" })
      .check();
  }
  await page
    .getByRole("button", { name: /Show the passage for Firma/ })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: target("import-review") });
});
