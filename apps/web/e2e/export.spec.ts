import { expect, type Page, test } from "@playwright/test";

// Fictional demo users and drafts from supabase/seed.sql.
const DEMO_PASSWORD = "demo-password-123";
const NORD_DRAFT = "00000000-0000-4000-8000-0000000d0a01";
const SUED_DRAFT = "00000000-0000-4000-8000-0000000d0b01";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

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
  expect(pdfBody.length).toBeGreaterThan(10_000);

  const docx = await page.request.get(
    `/app/documents/${NORD_DRAFT}/export?format=docx`,
  );
  expect(docx.status()).toBe(200);
  expect(docx.headers()["content-type"]).toBe(
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  const docxBody = await docx.body();
  expect(docxBody.subarray(0, 2).toString()).toBe("PK");
  expect(docxBody.length).toBeGreaterThan(10_000);
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
});

test("unsupported formats are rejected", async ({ page }) => {
  await signIn(page, "erik.editor@demo.test");

  const response = await page.request.get(
    `/app/documents/${NORD_DRAFT}/export?format=html`,
  );
  expect(response.status()).toBe(400);
});
