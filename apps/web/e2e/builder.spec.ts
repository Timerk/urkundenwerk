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

test("an editor prepares and downloads the deed and register filing", async ({
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
  await textbox(page, "Date of birth").fill("07/03/1990");
  await textbox(page, "Street and number").fill("Musterweg 12");
  await textbox(page, "Postcode").fill("12345");
  await textbox(page, "Town or city").fill("Musterstadt");
  await textbox(page, "Firma (company name)").fill(firma);
  await textbox(page, "Sitz (registered seat)").fill("Musterstadt");
  await textbox(page, "Unternehmensgegenstand (business purpose)").fill(
    "die Entwicklung von Analysesoftware",
  );
  await textbox(page, "Stammkapital (share capital)").fill("30,000");
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
    "30,000",
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

  await page
    .getByRole("button", { name: "Handelsregisteranmeldung", exact: true })
    .click();
  const filingForm = page.getByRole("form", {
    name: "Handelsregisteranmeldung data",
  });
  await expect(
    page.getByRole("button", { name: "Download XML" }),
  ).toHaveAttribute("aria-disabled", "true");
  await filingForm
    .getByRole("textbox", { name: "Register court (Amtsgericht)" })
    .fill("Musterstadt");
  await filingForm
    .getByRole("textbox", { name: "Street and number" })
    .fill("Musterkai 4");
  await filingForm
    .getByRole("textbox", { name: "German postcode" })
    .fill("12345");
  await filingForm
    .getByRole("textbox", { name: "Town or city" })
    .fill("Musterstadt");
  await filingForm.getByRole("textbox", { name: "Amount paid" }).fill("30,000");
  for (const name of [
    /paid funds/,
    /No statutory grounds/,
    /director was instructed/,
  ]) {
    await filingForm.getByRole("checkbox", { name }).check();
  }
  await expect(
    preview.getByRole("heading", { name: "Handelsregisteranmeldung" }),
  ).toBeVisible();
  await expect(preview).toContainText("Musterkai 4, 12345 Musterstadt.");
  await expect(preview).toContainText("Erika Mustermann");
  await expect(page.getByText("Ready to export")).toBeVisible();

  const filingPdfDownload = page.waitForEvent("download");
  await download.click();
  const filingPdf = await filingPdfDownload;
  expect(filingPdf.suggestedFilename()).toBe(
    `Handelsregisteranmeldung-${filename}.pdf`,
  );
  expect(
    (await readFile(await filingPdf.path())).subarray(0, 5).toString(),
  ).toBe("%PDF-");

  const xmlDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download XML" }).click();
  const xml = await xmlDownload;
  expect(xml.suggestedFilename()).toBe(
    `Handelsregisteranmeldung-${filename}.xml`,
  );
  const xmlText = await readFile(await xml.path(), "utf8");
  const parsed = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    return {
      errors: doc.getElementsByTagName("parsererror").length,
      namespace: doc.documentElement.namespaceURI,
      firma: doc.getElementsByTagName("firma")[0]?.textContent,
    };
  }, xmlText);
  expect(parsed).toEqual({
    errors: 0,
    namespace: "urn:urkundenwerk:registeranmeldung:1",
    firma,
  });

  await page.reload();
  await waitForBuilder(page);
  await page
    .getByRole("button", { name: "Handelsregisteranmeldung", exact: true })
    .click();
  await expect(
    filingForm.getByRole("textbox", { name: "Amount paid" }),
  ).toHaveValue("30,000");
  await expect(page.getByText("Ready to export")).toBeVisible();

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
  // The rule shows next to the field and in the Checks panel.
  const suffixRule = "End the Firma with “GmbH” or “UG (haftungsbeschränkt)”.";
  await expect(
    page
      .getByRole("form", { name: "Musterprotokoll data" })
      .getByText(suffixRule),
  ).toBeVisible();
  await expect(page.getByTestId("checks-panel")).toContainText(suffixRule);

  await page.getByRole("button", { name: /fields to complete$/ }).click();
  await expect(page.getByText("Still missing")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Herr" })).toBeFocused();
});

test("the Checks panel explains a rule and leads to its field", async ({
  page,
}) => {
  await signIn(page, "erik.editor@demo.test");
  await page.getByRole("button", { name: "New Musterprotokoll" }).click();
  await expect(page).toHaveURL(/\/app\/documents\//);
  await waitForBuilder(page);

  const checks = page.getByTestId("checks-panel");
  await expect(checks.getByText("All checks pass")).toBeVisible();

  await textbox(page, "Firma (company name)").fill(
    "Hafenmuster UG (haftungsbeschränkt)",
  );
  await textbox(page, "Stammkapital (share capital)").fill("25,000");

  const issue = checks.locator('[data-issue="ug_capital_below_gmbh_minimum"]');
  await expect(issue).toContainText("A UG (haftungsbeschränkt) has less than");
  await expect(issue).toContainText("§ 5a Abs. 1 GmbHG");

  // AI_PROVIDER=fake answers with a scripted explanation.
  await issue.getByRole("button", { name: "Explain" }).click();
  await expect(issue).toContainText(
    "AI-generated explanation — not legal advice",
  );
  await expect(issue).toContainText("Scripted explanation for local testing.");
  await expect(issue).toContainText("Model fake-model, prompt explain-");

  await issue
    .getByRole("button", { name: "Go to Stammkapital (share capital)" })
    .click();
  await expect(textbox(page, "Stammkapital (share capital)")).toBeFocused();
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
