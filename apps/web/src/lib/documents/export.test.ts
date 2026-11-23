import { describe, expect, it, vi } from "vitest";
import { exportDocument, exportFilename } from "./export";
import type { AppSupabaseClient, DocumentRow } from "./repository";

const DOCUMENT_ID = "00000000-0000-4000-8000-0000000d0a01";
const USER_ID = "00000000-0000-4000-8000-00000000a002";
const REFERENCE_DATE = "2026-11-23";

const completeDraft = {
  notarisation: { mode: "in_person" },
  founder: {
    kind: "natural_person",
    salutation: "Frau",
    firstName: "Erika",
    lastName: "Mustermann",
    birthDate: "1990-03-07",
    address: {
      street: "Musterweg 12",
      postalCode: "12345",
      city: "Musterstadt",
    },
  },
  company: {
    name: "Nordmuster Logistik GmbH",
    seat: "Musterstadt",
    purpose: "die Planung von Logistikdienstleistungen",
  },
  shareCapitalCents: 2_500_000,
  contribution: "full",
  managingDirector: { kind: "founder" },
};

function documentRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: DOCUMENT_ID,
    tenant_id: "00000000-0000-4000-8000-0000000000aa",
    template_id: "musterprotokoll-einpersonen",
    template_version: "2022-08-01",
    title: "Nordmuster Logistik GmbH",
    data: completeDraft,
    status: "draft",
    created_by: USER_ID,
    created_at: "2026-11-23T10:00:00Z",
    updated_at: "2026-11-23T10:00:00Z",
    ...overrides,
  };
}

/** A client whose document lookup resolves to `row`, as RLS would return it. */
function fakeClient(row: DocumentRow | null) {
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as AppSupabaseClient, from, eq };
}

describe("exportDocument", () => {
  it("renders a complete draft as PDF with download headers", async () => {
    const { client, from, eq } = fakeClient(documentRow());

    const response = await exportDocument(client, USER_ID, {
      id: DOCUMENT_ID,
      format: "pdf",
      referenceDate: REFERENCE_DATE,
    });

    expect(from).toHaveBeenCalledWith("documents");
    expect(eq).toHaveBeenCalledWith("id", DOCUMENT_ID);
    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "content-type": "application/pdf",
      "content-disposition":
        'attachment; filename="Musterprotokoll-Nordmuster-Logistik-GmbH.pdf"',
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    const body = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(body.subarray(0, 5))).toBe("%PDF-");
    expect(response.headers.get("content-length")).toBe(
      String(body.byteLength),
    );
  });

  it("renders DOCX", async () => {
    const { client } = fakeClient(documentRow());

    const response = await exportDocument(client, USER_ID, {
      id: DOCUMENT_ID,
      format: "docx",
      referenceDate: REFERENCE_DATE,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const body = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(body.subarray(0, 2))).toBe("PK");
  });

  it("requires a signed-in user before touching the database", async () => {
    const { client, from } = fakeClient(documentRow());

    const response = await exportDocument(client, null, {
      id: DOCUMENT_ID,
      format: "pdf",
      referenceDate: REFERENCE_DATE,
    });

    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it.each([null, "html", "PDF"])("rejects the format %j", async (format) => {
    const { client } = fakeClient(documentRow());

    const response = await exportDocument(client, USER_ID, {
      id: DOCUMENT_ID,
      format,
      referenceDate: REFERENCE_DATE,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "unsupported_format",
      supported: ["pdf", "docx", "xml"],
    });
  });

  it("treats malformed ids and invisible documents as not found", async () => {
    const { client, from } = fakeClient(null);

    const malformed = await exportDocument(client, USER_ID, {
      id: "../tenants",
      format: "pdf",
      referenceDate: REFERENCE_DATE,
    });
    expect(malformed.status).toBe(404);
    expect(from).not.toHaveBeenCalled();

    const hidden = await exportDocument(client, USER_ID, {
      id: DOCUMENT_ID,
      format: "pdf",
      referenceDate: REFERENCE_DATE,
    });
    expect(hidden.status).toBe(404);
    expect(hidden.headers.get("cache-control")).toBe("no-store");
  });

  it("reports the missing fields of an incomplete draft", async () => {
    const { client } = fakeClient(
      documentRow({ data: { company: { name: "Nordmuster Logistik GmbH" } } }),
    );

    const response = await exportDocument(client, USER_ID, {
      id: DOCUMENT_ID,
      format: "pdf",
      referenceDate: REFERENCE_DATE,
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe("incomplete");
    expect(body.issues).toContainEqual(
      expect.objectContaining({ path: "company.seat", code: "field_required" }),
    );
  });

  it("includes the stable rule code of a cross-field violation", async () => {
    const { client } = fakeClient(
      documentRow({ data: { ...completeDraft, shareCapitalCents: 100_000 } }),
    );

    const response = await exportDocument(client, USER_ID, {
      id: DOCUMENT_ID,
      format: "pdf",
      referenceDate: REFERENCE_DATE,
    });

    expect(response.status).toBe(422);
    expect((await response.json()).issues).toEqual([
      {
        path: "shareCapitalCents",
        code: "gmbh_capital_minimum",
        message: "A GmbH needs a Stammkapital of at least 25.000 €.",
      },
    ]);
  });

  it("compares dates with the reference date of the request", async () => {
    const { client } = fakeClient(documentRow());

    const response = await exportDocument(client, USER_ID, {
      id: DOCUMENT_ID,
      format: "pdf",
      // The founder, born in 1990, is not born yet on this day.
      referenceDate: "1989-01-01",
    });

    expect(response.status).toBe(422);
    expect((await response.json()).issues).toContainEqual(
      expect.objectContaining({ code: "birth_date_not_in_future" }),
    );
  });

  it("exports despite warnings and notes", async () => {
    const { client } = fakeClient(
      documentRow({
        data: {
          ...completeDraft,
          company: {
            ...completeDraft.company,
            purpose: "Handel mit Waren aller Art",
          },
        },
      }),
    );

    const response = await exportDocument(client, USER_ID, {
      id: DOCUMENT_ID,
      format: "docx",
      referenceDate: REFERENCE_DATE,
    });

    expect(response.status).toBe(200);
  });

  it("rejects stored data that is not a valid draft", async () => {
    const { client } = fakeClient(documentRow({ data: { injected: "<x>" } }));

    const response = await exportDocument(client, USER_ID, {
      id: DOCUMENT_ID,
      format: "pdf",
      referenceDate: REFERENCE_DATE,
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("invalid_draft");
  });

  it("refuses template versions that the registry does not provide", async () => {
    const { client } = fakeClient(
      documentRow({ template_version: "2099-01-01" }),
    );

    const response = await exportDocument(client, USER_ID, {
      id: DOCUMENT_ID,
      format: "pdf",
      referenceDate: REFERENCE_DATE,
    });

    expect(response.status).toBe(409);
  });

  it.each(["pdf", "docx", "xml"])(
    "requires the filing data for %s",
    async (format) => {
      const { client } = fakeClient(documentRow());
      const response = await exportDocument(client, USER_ID, {
        id: DOCUMENT_ID,
        format,
        document: "anmeldung",
        referenceDate: REFERENCE_DATE,
      });
      expect(response.status).toBe(422);
      expect((await response.json()).issues).toContainEqual(
        expect.objectContaining({
          path: "filing.registerCourt",
          code: "filing_court_required",
        }),
      );
    },
  );

  it("rejects XML that fails the XSD with a non-personal 500", async () => {
    const { client } = fakeClient(
      documentRow({
        data: {
          ...completeDraft,
          filing: {
            registerCourt: "Musterstadt",
            businessAddress: {
              street: "Musterkai 4",
              postalCode: "12345",
              city: "Musterstadt",
            },
            paidCents: 2_500_000,
            fundsAtFreeDisposal: true,
            noDisqualification: true,
            instructedOnDisclosure: true,
          },
        },
      }),
    );
    const validator = await import("@urkundenwerk/core/register-filing-xml");
    const validate = vi
      .spyOn(validator, "validateRegisterFilingXml")
      .mockResolvedValueOnce(false);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await exportDocument(client, USER_ID, {
        id: DOCUMENT_ID,
        format: "xml",
        referenceDate: REFERENCE_DATE,
      });
      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.has("content-disposition")).toBe(false);
      expect(await response.json()).toEqual({ error: "xml_export_failed" });
      expect(log.mock.calls).toEqual([
        ["[export] Register filing XML generation or validation failed"],
      ]);
    } finally {
      log.mockRestore();
      validate.mockRestore();
    }
  });
});

describe("exportFilename", () => {
  it.each([
    ["Nordmuster Logistik GmbH", "Musterprotokoll-Nordmuster-Logistik-GmbH"],
    [
      "Südmuster Design UG (haftungsbeschränkt)",
      "Musterprotokoll-Suedmuster-Design-UG-haftungsbeschraenkt",
    ],
    ['Quote " and \r\n header', "Musterprotokoll-Quote-and-header"],
    ["Café Él", "Musterprotokoll-Cafe-El"],
    ["日本", "Musterprotokoll"],
  ])("derives a safe filename from %j", (title, expected) => {
    expect(exportFilename(title, "pdf")).toBe(`${expected}.pdf`);
  });

  it("limits the length", () => {
    expect(exportFilename("x".repeat(500), "docx").length).toBeLessThanOrEqual(
      "Musterprotokoll-".length + 80 + ".docx".length,
    );
  });
});
