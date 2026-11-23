// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildMusterprotokollPreview } from "@urkundenwerk/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentPreview } from "./document-preview";

afterEach(cleanup);

const model = buildMusterprotokollPreview({
  founder: { kind: "natural_person", firstName: "Erika" },
  company: { name: "Musterlicht GmbH" },
  shareCapitalCents: 2_500_000,
});

describe("DocumentPreview", () => {
  it("renders the heading and numbered clauses of the model", () => {
    render(<DocumentPreview model={model} />);

    expect(
      screen.getByRole("heading", { name: /Musterprotokoll/ }),
    ).toBeTruthy();
    const article = screen.getByRole("article");
    expect(article.getAttribute("lang")).toBe("de");
    expect(article.querySelectorAll("[data-clause]")).toHaveLength(7);
    expect(article.textContent).toContain(
      "Das Stammkapital der Gesellschaft beträgt 25.000 € (i. W. fünfundzwanzigtausend Euro)",
    );
  });

  it("marks filled values and labels blanks with what is missing", () => {
    render(<DocumentPreview model={model} />);

    const article = screen.getByRole("article");
    const company = article.querySelector('[data-path="company.name"]');
    expect(company?.className).toBe("deed-field");
    expect(company?.textContent).toBe("Musterlicht GmbH");
    const seat = article.querySelector('[data-path="company.seat"]');
    expect(seat?.className).toBe("deed-blank");
    expect(seat?.textContent).toBe("Sitz");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("reports the field path when a value or blank is chosen", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<DocumentPreview model={model} onSelect={onSelect} />);

    await user.click(
      screen.getByRole("button", {
        name: "Musterlicht GmbH, edit Firma (company name)",
      }),
    );
    expect(onSelect).toHaveBeenLastCalledWith("company.name");

    screen
      .getByRole("button", { name: "Missing: Sitz (registered seat)" })
      .focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("company.seat");
  });

  it("highlights every run of the active path", () => {
    render(
      <DocumentPreview
        model={model}
        onSelect={() => {}}
        activePath="founder.firstName"
      />,
    );

    const runs = screen
      .getByRole("article")
      .querySelectorAll('[data-path="founder.firstName"]');
    expect(runs.length).toBeGreaterThan(1);
    for (const run of runs) {
      expect(run.getAttribute("data-active")).toBe("true");
    }
  });
});
