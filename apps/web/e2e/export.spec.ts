import { expect, test } from "@playwright/test";
import { NORD_DRAFT, signIn, SUED_DRAFT } from "./helpers";

test("a viewer exports a complete draft as PDF and DOCX", async ({ page }) => {
  await signIn(page, "victor.viewer@demo.test");

  const pdf = await page.request.get(
    `/app/documents/${NORD_DRAFT}/export?format=pdf`,
  );
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toBe(
    'attachment; filename="Musterprotokoll-Nordmuster-Logistik-GmbH.pdf"',
  );
  expect(pdf.headers()["cache-control"]).toBe("no-store");
  const pdfBody = await pdf.body();
  expect(pdfBody.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdfBody.length).toBeGreaterThan(5_000);

  const docx = await page.request.get(
    `/app/documents/${NORD_DRAFT}/export?format=docx`,
  );
  expect(docx.status()).toBe(200);
  expect(docx.headers()["content-type"]).toBe(
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  const docxBody = await docx.body();
  expect(docxBody.subarray(0, 2).toString()).toBe("PK");
  expect(docxBody.length).toBeGreaterThan(5_000);

  const filing = await page.request.get(
    `/app/documents/${NORD_DRAFT}/export?format=docx&document=anmeldung`,
  );
  expect(filing.status()).toBe(200);
  expect(filing.headers()["content-disposition"]).toBe(
    'attachment; filename="Handelsregisteranmeldung-Nordmuster-Logistik-GmbH.docx"',
  );
  expect((await filing.body()).subarray(0, 2).toString()).toBe("PK");
});

test("an incomplete draft is rejected with its missing fields", async ({
  page,
}) => {
  await signIn(page, "sara.admin@demo.test");

  const response = await page.request.get(
    `/app/documents/${SUED_DRAFT}/export?format=pdf`,
  );
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(body.error).toBe("incomplete");
  expect(body.issues).toContainEqual(
    expect.objectContaining({ path: "shareCapitalCents" }),
  );
});

test("a document of another firm is not found", async ({ page }) => {
  await signIn(page, "sara.admin@demo.test");

  const response = await page.request.get(
    `/app/documents/${NORD_DRAFT}/export?format=pdf`,
  );
  expect(response.status()).toBe(404);

  const xml = await page.request.get(
    `/app/documents/${NORD_DRAFT}/export?format=xml`,
  );
  expect(xml.status()).toBe(404);
});

test("unsupported formats are rejected", async ({ page }) => {
  await signIn(page, "erik.editor@demo.test");

  const response = await page.request.get(
    `/app/documents/${NORD_DRAFT}/export?format=html`,
  );
  expect(response.status()).toBe(400);
});
