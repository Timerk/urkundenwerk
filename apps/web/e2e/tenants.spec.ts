import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a member of two firms switches between them", async ({ page }) => {
  await signIn(page, "mia.multi@demo.test");

  const firm = page.getByRole("combobox", { name: "Firm" });
  await expect(firm).toHaveValue("00000000-0000-4000-8000-0000000000aa");
  await expect(
    page.getByRole("heading", { name: "Demo-Kanzlei Nord", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New Musterprotokoll" }),
  ).toBeVisible();

  await firm.selectOption({ label: "Demo-Kanzlei Süd (Viewer)" });

  await expect(
    page.getByRole("heading", { name: "Demo-Kanzlei Süd", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Your role: Viewer.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Südmuster Design UG" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New Musterprotokoll" }),
  ).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Demo-Kanzlei Süd", level: 1 }),
  ).toBeVisible();
});

test("a selected firm the user does not belong to is ignored", async ({
  page,
  context,
}) => {
  await signIn(page, "erik.editor@demo.test");
  await context.addCookies([
    {
      name: "uw-tenant",
      value: "00000000-0000-4000-8000-0000000000bb",
      url: new URL("/app", page.url()).toString(),
    },
  ]);

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Demo-Kanzlei Nord", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Südmuster")).toHaveCount(0);
});
