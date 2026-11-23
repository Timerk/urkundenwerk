import { expect, type Page } from "@playwright/test";

// Fictional demo users and drafts from supabase/seed.sql.
export const DEMO_PASSWORD = "demo-password-123";
export const NORD_DRAFT = "00000000-0000-4000-8000-0000000d0a01";
export const SUED_DRAFT = "00000000-0000-4000-8000-0000000d0b01";

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}
