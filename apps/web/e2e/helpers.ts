import { expect, type Page } from "@playwright/test";

// Fictional demo users and drafts from supabase/seed.sql.
export const DEMO_PASSWORD = "demo-password-123";
export const NORD_DRAFT = "00000000-0000-4000-8000-0000000d0a01";
export const SUED_DRAFT = "00000000-0000-4000-8000-0000000d0b01";

/** Signs in through the form in either UI language. */
export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/^(Email address|E-Mail-Adresse)$/).fill(email);
  await page.getByLabel(/^(Password|Passwort)$/).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /^(Sign in|Anmelden)$/ }).click();
  await expect(page).toHaveURL(/\/app$/);
}
