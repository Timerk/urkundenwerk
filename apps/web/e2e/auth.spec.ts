import { expect, test } from "@playwright/test";

// Uses the fictional demo users from supabase/seed.sql.
const DEMO_PASSWORD = "demo-password-123";

test("an unauthenticated visit to /app redirects to the login page", async ({
  page,
}) => {
  await page.goto("/app");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in", level: 1 }),
  ).toBeVisible();
});

test("a seeded admin signs in, sees their firm, and signs out", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("anna.admin@demo.test");
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/app$/);
  const firm = page.getByRole("listitem").filter({
    hasText: "Demo-Kanzlei Nord",
  });
  await expect(firm).toContainText("Admin");
  await expect(page.getByText("Demo-Kanzlei Süd")).toHaveCount(0);
  await expect(
    page.getByText(
      "Demonstration project. Not legal advice. Uses fictional data only.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});

test("wrong credentials show an error without revealing which field was wrong", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("anna.admin@demo.test");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "The email address or password is incorrect." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("signing up creates a firm with the new user as admin", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}-${test.info().workerIndex}@demo.test`;

  await page.goto("/signup");
  await page.getByLabel("Firm name").fill("Demo-Kanzlei Testlauf");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Demo-Kanzlei Testlauf" }),
  ).toContainText("Admin");
});
