import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./helpers";

// A German browser: the UI starts in German until a language is chosen.
test.use({ locale: "de-DE" });

function language(page: Page) {
  return page.getByRole("group", { name: /^(Sprache|Language)$/ }).first();
}

test("a German browser gets the German UI", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(
    page.getByRole("link", { name: "Zur Demo anmelden" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Demonstrationsprojekt. Keine Rechtsberatung. Nur fiktive Daten.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    language(page).getByRole("button", { name: "DE" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveTitle("Urkundenwerk");
});

test("switching to English persists across reload and navigation", async ({
  page,
}) => {
  await page.goto("/");
  const english = language(page).getByRole("button", { name: "EN" });
  // The switcher is a form, so it works from the keyboard as well.
  await english.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("link", { name: "Sign in to the demo" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(english).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(
    page.getByRole("link", { name: "Sign in to the demo" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Sign in to the demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in", level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Sign in · Urkundenwerk");

  // And back: the choice is the user's, whatever the browser prefers.
  await language(page).getByRole("button", { name: "DE" }).click();
  await expect(
    page.getByRole("heading", { name: "Anmelden", level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Anmelden · Urkundenwerk");
});

test("the builder keeps typed input across a language switch", async ({
  page,
}) => {
  await signIn(page, "erik.editor@demo.test");
  await expect(page.getByRole("heading", { name: "Dokumente" })).toBeVisible();
  await page.getByRole("button", { name: "Neues Musterprotokoll" }).click();
  await expect(page).toHaveURL(/\/app\/documents\/[0-9a-f-]{36}$/);
  await expect(page.locator("[data-builder-ready]")).toBeAttached();

  const firma = `Sprachwechsel ${Date.now().toString(36)} GmbH`;
  await page.getByRole("textbox", { name: "Firma", exact: true }).fill(firma);
  await page
    .getByRole("textbox", { name: "Vorname", exact: true })
    .fill("Erika");
  const birthDate = page.getByRole("textbox", { name: "Geburtsdatum" });
  // The German date format, which the native date input could not show.
  await birthDate.fill("07.03.1990");
  await birthDate.blur();
  await expect(birthDate).toHaveValue("07.03.1990");
  await expect(birthDate).toHaveAccessibleDescription(/TT\.MM\.JJJJ/);
  await expect(page.getByRole("article")).toContainText("7. März 1990");
  await page.getByRole("textbox", { name: "Stammkapital" }).fill("25.000");

  // Switch at once, before the autosave runs.
  await language(page).getByRole("button", { name: "EN" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await expect(
    page.getByRole("textbox", { name: "Firma (company name)", exact: true }),
  ).toHaveValue(firma);
  await expect(
    page.getByRole("textbox", { name: "First name", exact: true }),
  ).toHaveValue("Erika");
  // Complete values are rewritten in the new language's format.
  await expect(
    page.getByRole("textbox", { name: "Date of birth" }),
  ).toHaveValue("07/03/1990");
  await expect(
    page.getByRole("textbox", { name: "Stammkapital (share capital)" }),
  ).toHaveValue("25,000");
  // The deed stays German.
  await expect(page.getByRole("article")).toContainText("7. März 1990");
  await expect(page.getByRole("status").getByText(/^Saved at/)).toBeVisible();

  await page.reload();
  await expect(page.locator("[data-builder-ready]")).toBeAttached();
  await expect(
    page.getByRole("textbox", { name: "Firma (company name)", exact: true }),
  ).toHaveValue(firma);
  await expect(
    page.getByRole("textbox", { name: "Date of birth" }),
  ).toHaveValue("07/03/1990");
});

test("the German Checks panel words rules with German amounts", async ({
  page,
}) => {
  await signIn(page, "erik.editor@demo.test");
  await page.getByRole("button", { name: "Neues Musterprotokoll" }).click();
  await expect(page.locator("[data-builder-ready]")).toBeAttached();

  await page
    .getByRole("textbox", { name: "Firma", exact: true })
    .fill("Hafenmuster GmbH");
  await page.getByRole("textbox", { name: "Stammkapital" }).fill("20.000");

  const checks = page.getByTestId("checks-panel");
  const issue = checks.locator('[data-issue="gmbh_capital_minimum"]');
  await expect(
    checks.getByRole("heading", { name: "Prüfungen" }),
  ).toBeVisible();
  await expect(issue).toContainText(
    "Eine GmbH benötigt ein Stammkapital von mindestens 25.000 €.",
  );
  await expect(issue).toContainText("§ 5 Abs. 1 GmbHG");

  // The scripted model answers in the UI language.
  await issue.getByRole("button", { name: "Erläutern" }).click();
  await expect(issue).toContainText(
    "KI-generierte Erläuterung – keine Rechtsberatung",
  );
  await expect(issue).toContainText(
    "Skriptgesteuerte Erläuterung für lokale Tests.",
  );
});
