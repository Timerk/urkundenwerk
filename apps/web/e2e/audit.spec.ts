import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("an edit appears in the German activity panel", async ({
  page,
  context,
}, info) => {
  await context.addCookies([
    { name: "uw-locale", value: "de", url: "http://127.0.0.1:3100" },
  ]);
  await signIn(page, "erik.editor@demo.test");
  await page.getByRole("button", { name: "Neues Musterprotokoll" }).click();
  await expect(page.locator("[data-builder-ready]")).toBeAttached();
  await page.getByText("Verlauf", { exact: true }).click();
  const name = page.getByRole("textbox", { name: "Firma", exact: true });
  await name.fill("Fiktives Verlaufsmuster GmbH");
  await expect(page.getByText("Dokument bearbeitet").first()).toBeVisible();
  await expect(
    page
      .locator("details")
      .filter({ has: page.getByText("Verlauf", { exact: true }) }),
  ).toContainText("Erik Editor");
  await page.getByText("Verlauf", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("verlauf-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Verlauf", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("verlauf-mobile.png") });
});

test("an admin can filter the audit log, a viewer cannot open it", async ({
  page,
  browser,
}, info) => {
  await signIn(page, "anna.admin@demo.test");
  await page
    .getByRole("navigation", { name: "Application navigation" })
    .getByRole("link", { name: "Audit log" })
    .click();
  await expect(page.getByRole("link", { name: "Audit log" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByRole("heading", { name: "Firm audit log" }),
  ).toBeVisible();
  await page.getByLabel("Action").selectOption("document.created");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/action=document.created/);
  await expect(
    page.getByRole("link", { name: "Reset filters" }).first(),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("audit-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("audit-mobile.png") });

  const viewer = await browser.newPage();
  try {
    await signIn(viewer, "victor.viewer@demo.test");
    await viewer.goto("/app/audit");
    await expect(
      viewer.getByRole("heading", {
        name: /Page not found|Seite nicht gefunden/,
      }),
    ).toBeVisible();
  } finally {
    await viewer.close();
  }
});
