import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DemoNotice } from "../components/demo-notice";
import Home from "./page";

it("explains the product and links to the demo", () => {
  const html = renderToStaticMarkup(<Home />);

  expect(html).toContain("Sign in to the demo");
  expect(html).toContain("It gives no legal advice");
});

it("shows an excerpt assembled from fictional data", () => {
  const html = renderToStaticMarkup(<Home />);

  expect(html).toContain("Nordmuster Logistik GmbH");
  expect(html).toContain("fünfundzwanzigtausend");
});

it("states the demonstration notice that the root layout shows on every page", () => {
  expect(renderToStaticMarkup(<DemoNotice />)).toContain(
    "Demonstration project. Not legal advice. Uses fictional data only.",
  );
});
