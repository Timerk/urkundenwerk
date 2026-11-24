import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("an editor deletes a document after confirming in place", async ({
  page,
}, info) => {
  // A unique Firma, which becomes the title, keeps repeated runs apart.
  const firma = `Löschmuster ${Date.now().toString(36)} GmbH`;

  await signIn(page, "erik.editor@demo.test");
  await page.getByRole("button", { name: "New Musterprotokoll" }).click();
  await expect(page.locator("[data-builder-ready]")).toBeAttached();
  await page
    .getByRole("textbox", { name: "Firma (company name)", exact: true })
    .fill(firma);
  await expect(
    page.getByRole("textbox", { name: "Document title" }),
  ).toHaveValue(firma);
  await expect(page.getByRole("status").getByText(/^Saved at/)).toBeVisible();

  await page.goto("/app");
  const row = page.getByRole("row", { name: new RegExp(firma) });
  const trigger = row.getByRole("button", { name: `Delete: ${firma}` });
  const question = page.getByRole("group", { name: `Delete “${firma}”?` });

  // Escape backs out and returns focus to the trigger.
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(question).toContainText("The audit log keeps a record");
  await expect(question.getByText(`Delete “${firma}”?`)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(question).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // So does Cancel.
  await trigger.click();
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(question).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.screenshot({ path: info.outputPath("delete-en-desktop.png") });
  await question.getByRole("button", { name: "Delete", exact: true }).click();

  const status = page.getByRole("status").filter({ hasText: "was deleted" });
  await expect(status).toHaveText(`“${firma}” was deleted.`);
  await expect(page).toHaveURL(/\/app$/);
  await expect(row).toHaveCount(0);
  // Focus moves to the announcement, not to a vanished control.
  await expect(page.locator(":focus")).toContainText("was deleted");
  await expect(page.getByRole("link", { name: firma })).toHaveCount(0);
});

test("the delete confirmation reads in German on a phone", async ({
  page,
}, info) => {
  await signIn(page, "erik.editor@demo.test");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "DE", exact: true }).click();

  const row = page.getByRole("row", { name: /Nordmuster Logistik GmbH/ });
  await row
    .getByRole("button", { name: "Löschen: Nordmuster Logistik GmbH" })
    .click();
  const question = page.getByRole("group", {
    name: "„Nordmuster Logistik GmbH“ löschen?",
  });
  await expect(question).toContainText(
    "Im Kanzleiprotokoll bleibt die Löschung vermerkt.",
  );
  await expect(question.getByRole("button", { name: "Löschen" })).toBeVisible();
  // The panel fits the phone without horizontal scrolling.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await question.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("delete-de-mobile.png") });
  await question.getByRole("button", { name: "Abbrechen" }).click();
  await expect(question).toHaveCount(0);
});
