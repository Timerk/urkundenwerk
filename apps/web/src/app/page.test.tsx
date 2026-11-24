import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { DemoNotice } from "../components/demo-notice";
import { withIntl } from "../test/i18n";
import Home from "./page";

const render = (ui: React.ReactNode, locale?: "de" | "en") =>
  renderToStaticMarkup(withIntl(ui, locale));

afterEach(() => vi.unstubAllEnvs());

it("hides the sign-up link when registration is disabled", () => {
  vi.stubEnv("NEXT_PUBLIC_SIGNUP_ENABLED", "false");
  expect(render(<Home />)).not.toContain('href="/signup"');
});

it("explains the product and links to the demo", () => {
  const html = render(<Home />);

  expect(html).toContain("Sign in to the demo");
  expect(html).toContain("It gives no legal advice");
});

it("shows an excerpt assembled from fictional data", () => {
  const html = render(<Home />);

  expect(html).toContain("Nordmuster Logistik GmbH");
  expect(html).toContain("fünfundzwanzigtausend");
});

it("states the demonstration notice that the root layout shows on every page", () => {
  expect(render(<DemoNotice />)).toContain(
    "Demonstration project. Not legal advice. Uses fictional data only.",
  );
  expect(render(<DemoNotice />, "de")).toContain(
    "Demonstrationsprojekt. Keine Rechtsberatung. Nur fiktive Daten.",
  );
});

it("offers the language switcher with the current language pressed", () => {
  const html = render(<Home />, "de");

  expect(html).toContain("Zur Demo anmelden");
  expect(html).toMatch(/aria-pressed="true"[^>]*>DE</);
  expect(html).toMatch(/aria-pressed="false"[^>]*>EN</);
});
