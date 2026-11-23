import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import Home from "./page";

it("includes the disclaimer in the server-rendered homepage", () => {
  const html = renderToStaticMarkup(<Home />);

  expect(html).toContain(
    "Demonstration project. Not legal advice. Uses fictional data only.",
  );
});
