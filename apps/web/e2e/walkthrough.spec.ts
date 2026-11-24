import { expect, type Locator, test } from "@playwright/test";
import { signIn } from "./helpers";

test.skip(process.env.WALKTHROUGH !== "1", "Run pnpm record:walkthrough.");

const size = { width: 1280, height: 800 };
test.use({
  viewport: size,
  video: { mode: "on", size },
  reducedMotion: "reduce",
  trace: "off",
});

// These pauses set the pace of the recording. Assertions wait for the UI.
function hold(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function click(control: Locator) {
  await control.hover();
  await control.evaluate((element) => {
    element.animate([{ outline: "3px solid #ad623c", outlineOffset: "3px" }], {
      duration: 500,
    });
  });
  await hold(220);
  await control.click();
}

test("record the README walkthrough", async ({ page }) => {
  test.setTimeout(90_000);
  const documents = page.getByRole("link", { name: "Documents", exact: true });
  const nord = page.getByRole("link", { name: "Nordmuster Logistik GmbH" });
  const preview = page.getByRole("article");

  await page.goto("/");
  await hold(2400);
  await click(page.getByRole("link", { name: "Sign in to the demo" }));
  const editor = page.getByRole("button", { name: /erik.editor@demo.test/ });
  await expect(editor).toBeInViewport();
  await hold(1700);
  await click(editor);
  await expect(nord).toBeVisible();
  await hold(1100);
  await click(nord);
  await expect(page.locator("[data-builder-ready]")).toBeAttached();
  await hold(1600);

  const company = page.getByRole("textbox", {
    name: "Firma (company name)",
    exact: true,
  });
  await click(company);
  await company.press("ControlOrMeta+a");
  await company.pressSequentially("Hafenmuster Logistik GmbH", { delay: 55 });
  await expect(preview).toContainText("Hafenmuster Logistik GmbH");
  await hold(2000);

  const capital = page.getByRole("textbox", {
    name: "Stammkapital (share capital)",
  });
  const issue = page
    .getByTestId("checks-panel")
    .locator('[data-issue="gmbh_capital_minimum"]');
  const pdf = page.getByRole("button", { name: "Download PDF" });
  await click(capital);
  await capital.fill("20,000");
  await capital.blur();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(issue).toBeInViewport();
  await expect(pdf).toHaveAttribute("aria-disabled", "true");
  await hold(3200);
  await click(capital);
  await capital.fill("25,000");
  await capital.blur();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(issue).toHaveCount(0);
  await expect(pdf).toBeEnabled();
  await expect(page.getByRole("status").getByText(/^Saved at/)).toBeVisible();
  await hold(1100);

  await click(documents);
  await click(page.getByRole("link", { name: "Import from contract" }));
  const sample = page.getByRole("button", {
    name: "Use sample Musterprotokoll (PDF)",
  });
  await expect(sample).toBeInViewport();
  await hold(1800);
  await click(sample);
  await expect(
    page.getByRole("heading", { name: "Review extracted values" }),
  ).toBeVisible();
  await hold(1000);
  const extractedCompany = page.getByRole("listitem", {
    name: "Firma (company name)",
    exact: true,
  });
  await expect(extractedCompany).toContainText("Verified in source");
  await click(
    extractedCompany.getByRole("button", { name: /Show the passage/ }),
  );
  const citation = page
    .getByRole("article", { name: "Document text" })
    .locator('[data-source-paths~="company.name"]');
  await expect(citation).toHaveAttribute("data-active", "true");
  await expect(citation).toBeInViewport();
  await hold(3500);
  await click(page.getByRole("button", { name: "Accept all verified" }));
  await expect(page.getByText(/^All \d+ values decided$/)).toBeVisible();
  await hold(850);
  await click(page.getByRole("button", { name: "Create draft" }).first());
  await expect(
    page.getByText("Created from an imported contract"),
  ).toBeVisible();
  await hold(1600);

  await click(documents);
  await click(nord);
  await click(
    page.getByRole("button", { name: "Handelsregisteranmeldung", exact: true }),
  );
  await expect(
    preview.getByRole("heading", { name: "Handelsregisteranmeldung" }),
  ).toBeInViewport();
  await hold(2400);

  await click(page.getByRole("button", { name: "Sign out" }));
  await signIn(page, "anna.admin@demo.test");
  await click(page.getByRole("link", { name: "Audit log" }));
  await expect(
    page.getByRole("heading", { name: "Firm audit log" }),
  ).toBeVisible();
  await hold(2800);
});
