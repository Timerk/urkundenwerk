import { describe, expect, it } from "vitest";
import {
  completenessOf,
  exportFilename,
  MAX_DRAFT_BYTES,
  mergeDraft,
  parseDraft,
  resolveTenant,
  todayInGermany,
  unsetPath,
} from "./domain";
import { ToolError } from "./errors";
import { NORD, SUED } from "./test/fake-store";

describe("mergeDraft", () => {
  it("merges objects at every depth and replaces other values", () => {
    expect(
      mergeDraft(
        {
          founder: { firstName: "A", address: { city: "X" } },
          contribution: "half",
        },
        {
          founder: { address: { street: "Y" }, salutation: null },
          contribution: "full",
        },
      ),
    ).toEqual({
      founder: {
        firstName: "A",
        salutation: null,
        address: { city: "X", street: "Y" },
      },
      contribution: "full",
    });
  });

  it("does not mutate its inputs", () => {
    const base = { company: { name: "A GmbH" } };
    mergeDraft(base, { company: { seat: "B" } });
    expect(base).toEqual({ company: { name: "A GmbH" } });
  });

  it("replaces non-object stored data", () => {
    expect(mergeDraft("broken", { notaryNotes: "x" })).toEqual({
      notaryNotes: "x",
    });
  });
});

describe("unsetPath", () => {
  it("removes nested keys and ignores missing ones", () => {
    const draft = { company: { name: "A", seat: "B" } };
    expect(unsetPath(draft, "company.seat")).toEqual({
      company: { name: "A" },
    });
    expect(unsetPath(draft, "founder.address.city")).toBe(draft);
    expect(unsetPath(draft, "company")).toEqual({});
  });
});

describe("parseDraft", () => {
  it("rejects oversized drafts before parsing them", () => {
    const huge = { notaryNotes: "x".repeat(MAX_DRAFT_BYTES + 1) };
    expect(() => parseDraft(huge)).toThrow(/exceeds 32 KiB/);
  });

  it("reports schema issues with paths", () => {
    try {
      parseDraft({ founder: { kind: "robot" } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ToolError);
      expect((error as ToolError).details?.issues).toEqual([
        expect.objectContaining({ path: "founder.kind" }),
      ]);
    }
  });
});

describe("resolveTenant", () => {
  it("matches slugs case-insensitively and ids exactly", () => {
    expect(resolveTenant([NORD, SUED], "Demo-Kanzlei-Sued")).toBe(SUED);
    expect(resolveTenant([NORD, SUED], NORD.tenantId)).toBe(NORD);
  });
});

describe("completenessOf", () => {
  it("counts fields with errors once", () => {
    expect(
      completenessOf([
        {
          code: "field_required",
          severity: "error",
          paths: ["a"],
          params: {},
          message: "",
        },
        {
          code: "gmbh_capital_minimum",
          severity: "error",
          paths: ["a"],
          params: {},
          message: "",
        },
        {
          code: "company_purpose_specific",
          severity: "warning",
          paths: ["b"],
          params: {},
          message: "",
        },
        {
          code: "formation_costs_capped",
          severity: "info",
          paths: [],
          params: {},
          message: "",
        },
      ]),
    ).toEqual({
      ready: false,
      outstandingFields: 1,
      errors: 2,
      warnings: 1,
      notes: 1,
    });
  });
});

describe("helpers", () => {
  it("computes today in Germany", () => {
    expect(todayInGermany(new Date("2026-11-23T23:30:00Z"))).toBe("2026-11-24");
  });

  it("builds ASCII filenames", () => {
    expect(
      exportFilename("Südmuster Design UG (haftungsbeschränkt)", "pdf"),
    ).toBe("Musterprotokoll-Suedmuster-Design-UG-haftungsbeschraenkt.pdf");
    expect(exportFilename("../../", "docx")).toBe("Musterprotokoll.docx");
  });
});
