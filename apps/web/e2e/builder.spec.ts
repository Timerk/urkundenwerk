import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { NORD_DRAFT, signIn } from "./helpers";

function textbox(page: Page, name: string) {
  return page.getByRole("textbox", { name, exact: true });
}

/** Opens a document and waits until the builder responds to input. */
async function waitForBuilder(page: Page) {
  await expect(page.locator("[data-builder-ready]")).toBeAttached();
}

test("an editor drafts a Musterprotokoll and downloads it", async ({
  page,
}) => {
  // A unique Firma keeps repeated local runs apart.
  const firma = `Hafenmuster ${Date.now().toString(36)} GmbH`;
  const filename = firma.replaceAll(" ", "-");

  await signIn(page, "erik.editor@demo.test");
  await page.getByRole("button", { name: "New Musterprotokoll" }).click();
  await expect(page).toHaveURL(/\/app\/documents\/[0-9a-f-]{36}$/);
  await waitForBuilder(page);
  const documentUrl = page.url();

  const download = page.getByRole("button", { name: "Download PDF" });
  await expect(download).toHaveAttribute("aria-disabled", "true");

  await page.getByRole("radio", { name: "Frau" }).check();
  await textbox(page, "First name").fill("Erika");
  await textbox(page, "Last name").fill("Mustermann");
  await textbox(page, "Date of birth").fill("1990-03-07");
  await textbox(page, "Street and number").fill("Musterweg 12");
  await textbox(page, "Postcode").fill("12345");
  await textbox(page, "Town or city").fill("Musterstadt");
  await textbox(page, "Firma (company name)").fill(firma);
  await textbox(page, "Sitz (registered seat)").fill("Musterstadt");
  await textbox(page, "Unternehmensgegenstand (business purpose)").fill(
    "die Entwicklung von Analysesoftware",
  );
  await textbox(page, "Stammkapital (share capital)").fill("30.000");
  await page.getByRole("radio", { name: /^In full, immediately/ }).check();

  const preview = page.getByRole("article");
  await expect(preview).toContainText(
    `unter der Firma ${firma} mit dem Sitz in Musterstadt`,
  );
  await expect(preview).toContainText("30.000 € (i. W. dreißigtausend Euro)");
  await expect(page.getByText("Ready to export")).toBeVisible();
  await expect(download).not.toHaveAttribute("aria-disabled", "true");

  // The new document takes the Firma as its title, and every change is saved.
  await expect(
    page.getByRole("textbox", { name: "Document title" }),
  ).toHaveValue(firma);
  await expect(page.getByRole("status").getByText(/^Saved at/)).toBeVisible();

  await page.reload();
  await waitForBuilder(page);
  await expect(textbox(page, "Firma (company name)")).toHaveValue(firma);
  await expect(textbox(page, "Stammkapital (share capital)")).toHaveValue(
    "30.000",
  );
  await expect(page.getByRole("article")).toContainText("dreißigtausend");

  const pdfDownload = page.waitForEvent("download");
  await download.click();
  const pdf = await pdfDownload;
  expect(pdf.suggestedFilename()).toBe(`Musterprotokoll-${filename}.pdf`);
  const pdfBytes = await readFile(await pdf.path());
  expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdfBytes.length).toBeGreaterThan(5_000);

  const docxDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download DOCX" }).click();
  const docx = await docxDownload;
  expect(docx.suggestedFilename()).toBe(`Musterprotokoll-${filename}.docx`);
  const docxBytes = await readFile(await docx.path());
  expect(docxBytes.subarray(0, 2).toString()).toBe("PK");
  expect(docxBytes.length).toBeGreaterThan(5_000);

  const response = await page.request.get(`${documentUrl}/export?format=pdf`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");

  await page.getByRole("link", { name: "Documents" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(firma) }),
  ).toContainText("Ready to export");
});

test("choosing a value in the preview focuses its field", async ({ page }) => {
  await signIn(page, "erik.editor@demo.test");
  await page.goto(`/app/documents/${NORD_DRAFT}`);
  await waitForBuilder(page);

  await page
    .getByRole("article")
    .getByRole("button", { name: /^Nordmuster Logistik GmbH, edit Firma/ })
    .click();

  await expect(textbox(page, "Firma (company name)")).toBeFocused();
});

test("incomplete drafts point to the missing fields", async ({ page }) => {
  await signIn(page, "erik.editor@demo.test");
  await page.getByRole("button", { name: "New Musterprotokoll" }).click();
  await expect(page).toHaveURL(/\/app\/documents\//);
  await waitForBuilder(page);

  await textbox(page, "Firma (company name)").fill("Hafenmuster UG");
  await expect(
    page.getByText("End the Firma with “GmbH” or “UG (haftungsbeschränkt)”."),
  ).toBeVisible();

  await page.getByRole("button", { name: /fields to complete$/ }).click();
  await expect(page.getByText("Still missing")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Herr" })).toBeFocused();
});

test("a viewer opens a document read only", async ({ page }) => {
  await signIn(page, "victor.viewer@demo.test");
  await expect(
    page.getByRole("button", { name: "New Musterprotokoll" }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Nordmuster Logistik GmbH" }).click();
  await expect(page.getByText("Read only")).toBeVisible();
  await expect(textbox(page, "Firma (company name)")).toHaveAttribute(
    "readonly",
  );
  await expect(page.getByRole("radio", { name: "Frau" })).toBeDisabled();
  await expect(page.getByText("Ready to export")).toBeVisible();
});

test("a member of another firm gets a 404 for the document", async ({
  page,
}) => {
  await signIn(page, "sara.admin@demo.test");

  const response = await page.goto(`/app/documents/${NORD_DRAFT}`);

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Document not found" }),
  ).toBeVisible();
  await expect(page.getByText("Nordmuster")).toHaveCount(0);
});
