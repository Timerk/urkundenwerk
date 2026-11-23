import { expect, test } from "@playwright/test";

test("the homepage shows the demonstration notice", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Urkundenwerk", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Demonstration project. Not legal advice. Uses fictional data only.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
});
