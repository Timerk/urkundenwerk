// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { MusterprotokollDraft } from "@urkundenwerk/core";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Builder, type BuilderProps } from "./builder";
import { EnglishUi } from "../../../../../test/i18n";

const actions = vi.hoisted(() => ({
  saveDraft: vi.fn(async (...args: unknown[]) => ({
    args,
    ok: true as const,
    updatedAt: "2026-11-23T10:00:00Z",
  })),
  renameDocument: vi.fn(async (_id: unknown, title: unknown) => ({
    ok: true as const,
    title: String(title),
    updatedAt: "2026-11-23T10:00:00Z",
  })),
  explainDocumentIssues: vi.fn(
    async (_id: unknown, issues: { code: string; params: object }[]) => ({
      ok: true as const,
      result: {
        explanations: issues.map(({ code, params }) => ({
          code,
          params,
          explanation: `Plain explanation of ${code}.`,
          suggestedFix: "Lower the capital.",
          source: "model" as const,
        })),
        model: "fake-model",
        promptVersion: "explain-test",
        failure: null,
      },
    }),
  ),
}));

vi.mock("../actions", () => actions);
vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props} />
  ),
}));

beforeAll(() => {
  // Browser APIs that jsdom does not provide.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("min-width"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  actions.saveDraft.mockClear();
  actions.renameDocument.mockClear();
  actions.explainDocumentIssues.mockClear();
});

const DOCUMENT_ID = "00000000-0000-4000-8000-0000000d0a01";

function renderBuilder(
  overrides: Partial<BuilderProps> & {
    initialDraft?: MusterprotokollDraft;
  } = {},
) {
  return render(
    <Builder
      documentId={DOCUMENT_ID}
      title="Untitled Musterprotokoll"
      initialDraft={{}}
      updatedAt="2026-11-23T09:00:00Z"
      canEdit
      firmName="Demo-Kanzlei Nord"
      templateLabel="Musterprotokoll, single founder"
      referenceDate="2026-11-23"
      aiEnabled={false}
      {...overrides}
    />,
    { wrapper: EnglishUi },
  );
}

const preview = () => screen.getByRole("article");
const textbox = (name: string) => screen.getByRole("textbox", { name });

describe("Builder", () => {
  it("shows typed values in the preview", () => {
    renderBuilder();

    fireEvent.change(textbox("Firma (company name)"), {
      target: { value: "Hafenmuster Analytics GmbH" },
    });
    fireEvent.change(textbox("Stammkapital (share capital)"), {
      target: { value: "25,000" },
    });

    const article = preview();
    expect(
      article.querySelector('[data-path="company.name"]')?.textContent,
    ).toBe("Hafenmuster Analytics GmbH");
    expect(article.textContent).toContain(
      "beträgt 25.000 € (i. W. fünfundzwanzigtausend Euro)",
    );
    expect(screen.getByText("Legal form: GmbH.")).toBeTruthy();
  });

  it("maps choices to the draft and back to the deed's wording", () => {
    renderBuilder();

    fireEvent.click(screen.getByRole("radio", { name: "Herr" }));
    fireEvent.change(textbox("First name"), { target: { value: "Jonas" } });
    fireEvent.click(screen.getByRole("radio", { name: /^50 % now/ }));

    const text = preview().textContent;
    expect(text).toContain("vollständig von Herrn Jonas");
    expect(text).toContain("und zwar zu 50 Prozent sofort");
  });

  it("moves focus to the input of a value chosen in the preview", () => {
    renderBuilder();

    fireEvent.click(
      within(preview()).getByRole("button", {
        name: "Missing: Sitz (registered seat)",
      }),
    );

    expect(document.activeElement).toBe(textbox("Sitz (registered seat)"));
  });

  it("shows cross-field rules next to the field without waiting for blur", () => {
    renderBuilder();

    fireEvent.change(textbox("Firma (company name)"), {
      target: { value: "Hafenmuster UG (haftungsbeschränkt)" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /^50 % now/ }));

    // Next to the field and in the Checks panel.
    expect(
      screen.getAllByText(
        "A UG (haftungsbeschränkt) must be paid in full before registration (§ 5a Abs. 2 GmbHG).",
      ),
    ).toHaveLength(2);
  });

  it("reveals missing fields instead of downloading an incomplete draft", () => {
    renderBuilder();

    const download = screen.getByRole("button", { name: "Download PDF" });
    expect(download.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "12 fields to complete" }));

    fireEvent.click(download);

    expect(screen.getByText("Still missing")).toBeTruthy();
    expect(
      screen.getAllByText("Required to complete the deed.").length,
    ).toBeGreaterThan(5);
  });

  it("saves the draft after typing stops and reports the status", async () => {
    vi.useFakeTimers();
    renderBuilder();

    fireEvent.change(textbox("Sitz (registered seat)"), {
      target: { value: "Musterstadt" },
    });
    expect(screen.getByRole("status", { name: "" }).textContent).toContain(
      "Unsaved changes",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(actions.saveDraft).toHaveBeenCalledTimes(1);
    expect(actions.saveDraft).toHaveBeenCalledWith(
      DOCUMENT_ID,
      expect.objectContaining({ company: { seat: "Musterstadt" } }),
    );
    expect(screen.getByText(/^Saved at/)).toBeTruthy();
  });

  it("renames a new document after its Firma", async () => {
    vi.useFakeTimers();
    renderBuilder();

    fireEvent.change(textbox("Firma (company name)"), {
      target: { value: "Hafenmuster Analytics GmbH" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(actions.renameDocument).toHaveBeenCalledWith(
      DOCUMENT_ID,
      "Hafenmuster Analytics GmbH",
    );
    expect(
      (
        screen.getByRole("textbox", {
          name: "Document title",
        }) as HTMLInputElement
      ).value,
    ).toBe("Hafenmuster Analytics GmbH");
  });

  it("is read only for viewers and never saves", async () => {
    vi.useFakeTimers();
    renderBuilder({
      canEdit: false,
      title: "Nordmuster Logistik GmbH",
      initialDraft: { company: { name: "Nordmuster Logistik GmbH" } },
    });

    expect(screen.getByText("Read only")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Nordmuster Logistik GmbH" }),
    ).toBeTruthy();
    const name = textbox("Firma (company name)") as HTMLInputElement;
    expect(name.readOnly).toBe(true);
    // Choices are disabled through their fieldset.
    expect(
      screen.getByRole("radio", { name: "Herr" }).matches(":disabled"),
    ).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(actions.saveDraft).not.toHaveBeenCalled();
    expect(actions.renameDocument).not.toHaveBeenCalled();
  });
});

describe("Checks panel", () => {
  const panel = () => screen.getByTestId("checks-panel");
  const typeUgWithGmbhCapital = () => {
    fireEvent.change(textbox("Firma (company name)"), {
      target: { value: "Hafenmuster UG (haftungsbeschränkt)" },
    });
    fireEvent.change(textbox("Stammkapital (share capital)"), {
      target: { value: "25,000" },
    });
  };

  it("passes until a rule finds something", () => {
    renderBuilder();
    expect(within(panel()).getByText("All checks pass")).toBeTruthy();

    typeUgWithGmbhCapital();

    const item = within(panel()).getByRole("listitem");
    expect(item.textContent).toContain("§ 5a Abs. 1 GmbHG");
    expect(within(panel()).getByRole("heading", { name: /^To correct/ }));
  });

  it("moves focus to the affected field", () => {
    renderBuilder();
    typeUgWithGmbhCapital();

    fireEvent.click(
      within(panel()).getByRole("button", {
        name: "Go to Stammkapital (share capital)",
      }),
    );

    expect(document.activeElement).toBe(
      textbox("Stammkapital (share capital)"),
    );
  });

  it("explains an issue with its code and params only", async () => {
    renderBuilder({ aiEnabled: true });
    typeUgWithGmbhCapital();

    await act(async () => {
      fireEvent.click(within(panel()).getByRole("button", { name: "Explain" }));
    });

    expect(actions.explainDocumentIssues).toHaveBeenCalledWith(
      DOCUMENT_ID,
      [
        {
          code: "ug_capital_below_gmbh_minimum",
          params: { shareCapitalCents: 2_500_000, minimumCents: 2_500_000 },
        },
      ],
      "musterprotokoll",
    );
    const text = panel().textContent;
    expect(text).toContain("AI-generated explanation — not legal advice");
    expect(text).toContain(
      "Plain explanation of ug_capital_below_gmbh_minimum.",
    );
    expect(text).toContain("Model fake-model, prompt explain-test");
  });

  it("shows an error and lets the user try again", async () => {
    actions.explainDocumentIssues.mockResolvedValueOnce({
      ok: false,
      error: "AI explanations are turned off.",
    } as never);
    renderBuilder({ aiEnabled: true });
    typeUgWithGmbhCapital();

    await act(async () => {
      fireEvent.click(within(panel()).getByRole("button", { name: "Explain" }));
    });

    expect(panel().textContent).toContain("AI explanations are turned off.");
    expect(within(panel()).getByRole("button", { name: "Try again" }));
  });

  it("says when AI is turned off and offers no Explain button", () => {
    renderBuilder();
    typeUgWithGmbhCapital();

    expect(
      within(panel()).queryByRole("button", { name: "Explain" }),
    ).toBeNull();
    expect(panel().textContent).toContain(
      "AI explanations are turned off on this server.",
    );
  });
});
