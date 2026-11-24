import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./helpers";

// AI_PROVIDER=fake answers with scripted extraction: no network, no key.
const CONTRACT = join(
  __dirname,
  "../../../packages/extraction/eval/dev/11-musterprotokoll/document.pdf",
);

function row(page: Page, label: string) {
  return page.getByRole("listitem", { name: label, exact: true });
}

test("an editor imports a contract, reviews it, and opens the draft", async ({
  page,
}) => {
  await signIn(page, "erik.editor@demo.test");
  await page.getByRole("link", { name: "Import from contract" }).click();
  await expect(
    page.getByRole("heading", { name: "Import from a contract" }),
  ).toBeVisible();
  await expect(
    page.getByText("This server uses scripted extraction"),
  ).toBeVisible();

  await page.getByLabel(/Drop a PDF or DOCX here/).setInputFiles(CONTRACT);
  const heading = page.getByRole("heading", {
    name: "Review extracted values",
  });
  await expect(heading).toBeFocused();
  await expect(
    page.getByText("AI-extracted — review every value; not legal advice"),
  ).toBeVisible();

  const firma = row(page, "Firma (company name)");
  await expect(firma).toContainText("Schieferwabe Prüfstände GmbH");
  await expect(firma).toContainText("Verified in source");

  // A field leads to its passage, and the passage back to its field.
  await firma
    .getByRole("button", { name: /Show the passage for Firma/ })
    .click();
  const passage = page
    .getByRole("article", { name: "Document text" })
    .locator('[data-source-paths~="company.name"]');
  await expect(passage).toHaveAttribute("data-active", "true");
  await expect(passage).toContainText("Schieferwabe Prüfstände GmbH");
  await page
    .getByRole("button", { name: /^Passage for Sitz \(registered seat\)/ })
    .click();
  await expect(row(page, "Sitz (registered seat)")).toBeFocused();

  // Nothing is accepted yet, so the draft cannot be created.
  const create = page.getByRole("button", { name: "Create draft" }).first();
  await expect(create).toHaveAttribute("aria-disabled", "true");

  // Edit one value, accept the rest.
  const capital = row(page, "Stammkapital (share capital)");
  await capital.getByRole("radio", { name: "Edit" }).check();
  await capital
    .getByRole("textbox", {
      name: "New value for Stammkapital (share capital)",
    })
    .fill("20,000");
  await page.getByRole("button", { name: "Accept all verified" }).click();
  await expect(page.getByText(/^All \d+ values decided$/)).toBeVisible();

  await create.click();
  await expect(page).toHaveURL(/\/app\/documents\/[0-9a-f-]{36}\?imported=1$/);
  await expect(page.locator("[data-builder-ready]")).toBeAttached();
  await expect(
    page.getByText("Created from an imported contract"),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Firma (company name)", exact: true }),
  ).toHaveValue("Schieferwabe Prüfstände GmbH");
  await expect(
    page.getByRole("textbox", { name: "Stammkapital (share capital)" }),
  ).toHaveValue("20,000");
  await expect(
    page.getByRole("textbox", { name: "Document title" }),
  ).toHaveValue("Schieferwabe Prüfstände GmbH");

  // The builder's rules check the imported values at once.
  await expect(
    page
      .getByTestId("checks-panel")
      .locator('[data-issue="gmbh_capital_minimum"]'),
  ).toContainText("§ 5 Abs. 1 GmbHG");
});

test("files of the wrong type or size get a friendly error", async ({
  page,
}) => {
  await signIn(page, "erik.editor@demo.test");
  await page.goto("/app/import");
  const input = page.getByLabel(/Drop a PDF or DOCX here/);

  await input.setInputFiles({
    name: "notizen.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Keine Satzung."),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "file" }),
  ).toContainText("Only PDF and DOCX files can be imported.");

  await input.setInputFiles({
    name: "zu-gross.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(4 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "file" }),
  ).toContainText("The file is larger than 4 MB.");
  await expect(
    page.getByRole("heading", { name: "Review extracted values" }),
  ).toHaveCount(0);
});

test("a viewer cannot import contracts", async ({ page }) => {
  await signIn(page, "victor.viewer@demo.test");
  await expect(
    page.getByRole("link", { name: "Import from contract" }),
  ).toHaveCount(0);

  await page.goto("/app/import");
  await expect(
    page.getByText("Importing needs the editor or admin role"),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});
