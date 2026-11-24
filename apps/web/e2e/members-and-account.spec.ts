import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, signIn } from "./helpers";

test("members join by invitation, roles are audited, and account data downloads", async ({
  page,
  browser,
}, info) => {
  const email = `invitee-${Date.now()}@demo.test`;
  const invitee = await browser.newPage({ locale: "en-GB" });
  try {
    await invitee.goto("/signup");
    await invitee.getByLabel("Firm name").fill("Fictional Solo Firm");
    await invitee.getByLabel("Email address").fill(email);
    await invitee.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await invitee
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(invitee).toHaveURL(/\/app$/);
    await invitee.getByRole("button", { name: "Sign out" }).click();
    await expect(invitee).toHaveURL(/\/login$/);

    await signIn(page, "sara.admin@demo.test");
    await page.getByRole("link", { name: "Members", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Members", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Invitee email address").fill(email);
    await page.getByRole("button", { name: "Create invitation" }).click();
    const link = page.getByRole("textbox", { name: "Invitation link" });
    await expect(link).toHaveValue(
      /^http:\/\/127\.0\.0\.1:3100\/invite#[0-9a-f]{64}$/,
    );
    await invitee.goto(await link.inputValue());
    await expect(invitee).toHaveURL(/\/login\?next=invite$/);
    await invitee.getByLabel("Email address").fill(email);
    await invitee.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await invitee.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(invitee).toHaveURL(/\/invite$/);
    await invitee.getByRole("button", { name: "Accept invitation" }).click();
    await expect(invitee).toHaveURL(/\/app\/members$/);
    await expect(
      invitee.getByText(email, { exact: true }).last(),
    ).toBeVisible();
    await expect(
      invitee.getByRole("button", { name: "Save role" }),
    ).toHaveCount(0);

    await page.reload();
    const member = page
      .getByRole("list", { name: "Members" })
      .getByRole("listitem")
      .filter({ hasText: email });
    await expect(member).toBeVisible();
    await member.getByLabel("Role", { exact: true }).selectOption("editor");
    await member.getByRole("button", { name: "Save role" }).click();
    await expect(member.getByText("Role saved.")).toBeVisible();
    await page.screenshot({
      path: info.outputPath("members-en-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "DE", exact: true }).click();
    await expect(
      page.getByText("Die Rolle wurde gespeichert.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mitglieder" }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("mitglieder-de-mobile.png"),
      fullPage: true,
    });

    await page.getByRole("link", { name: "Kanzleiprotokoll" }).click();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Rolle geändert" })
        .filter({ hasText: email })
        .first(),
    ).toBeVisible();

    await invitee.getByRole("link", { name: "Account", exact: true }).click();
    await expect(
      invitee.getByRole("heading", { name: "Account", exact: true }),
    ).toBeVisible();
    await invitee.reload();
    const downloading = invitee.waitForEvent("download");
    await invitee.getByRole("link", { name: "Download my data" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe("urkundenwerk-account.json");
    const json = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(json.profile.email).toBe(email);
    expect(json.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "editor" }),
        expect.objectContaining({ role: "admin", name: "Fictional Solo Firm" }),
      ]),
    );
    expect(json.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "membership.added",
          actorId: json.profile.id,
        }),
      ]),
    );
    expect(JSON.stringify(json)).not.toContain("sara.admin@demo.test");
    await invitee.screenshot({
      path: info.outputPath("account-en-desktop.png"),
      fullPage: true,
    });
    await invitee.setViewportSize({ width: 390, height: 844 });
    await invitee.getByRole("button", { name: "DE", exact: true }).click();
    await expect(
      invitee.getByRole("heading", { name: "Konto", exact: true }),
    ).toBeVisible();
    await invitee.screenshot({
      path: info.outputPath("konto-de-mobile.png"),
      fullPage: true,
    });

    await invitee.getByRole("button", { name: "EN", exact: true }).click();
    await invitee
      .getByRole("checkbox", {
        name: "I want to permanently delete my account.",
      })
      .check();
    await invitee
      .getByRole("checkbox", {
        name: /I also want to permanently delete these firms/,
      })
      .check();
    await invitee.getByRole("button", { name: "Delete my account" }).click();
    await expect(invitee).toHaveURL(/\/$/);
    await invitee.goto("/login");
    await invitee.getByLabel("Email address").fill(email);
    await invitee.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await invitee.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      invitee.getByRole("alert").filter({ hasText: /incorrect|invalid/i }),
    ).toBeVisible();
  } finally {
    await invitee.close();
  }
});

test("privacy notice and imprint are public and localized", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy notice" }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy notice" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Supabase provides authentication/),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("privacy-en-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "DE", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Datenschutzhinweise" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("datenschutz-de-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Impressum" })
    .click();
  await expect(page.getByRole("heading", { name: "Impressum" })).toBeVisible();
  await expect(
    page.getByText("Das Impressum wurde noch nicht eingerichtet."),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("impressum-de-mobile.png") });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Legal notice" }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("imprint-en-desktop.png") });
});
