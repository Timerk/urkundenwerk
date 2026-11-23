import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as filingXml from "@urkundenwerk/core/register-filing-xml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DRAFT_SCHEMA_URI, RULES_URI } from "./server";
import { StoreError } from "./store";
import { connect } from "./test/client";
import {
  COMPLETE_DRAFT,
  COMPLETE_FILING,
  FakeStore,
  NORD,
  SUED,
} from "./test/fake-store";

const TODAY = "2026-11-23";

let store: FakeStore;
let exportDir: string | undefined;
let session: Awaited<ReturnType<typeof connect>>;

async function start(
  options: { exportDir?: string; log?: (message: string) => void } = {},
) {
  session = await connect({
    context: { store, today: () => TODAY, exportDir: options.exportDir },
    log: options.log ?? (() => undefined),
  });
  return session;
}

beforeEach(() => {
  store = new FakeStore([NORD]);
  exportDir = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await session?.close();
  if (exportDir) await rm(exportDir, { recursive: true, force: true });
});

describe("tool list", () => {
  it("exposes prefixed tools with annotations and output schemas", async () => {
    const { client } = await start();
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

    expect(Object.keys(byName).sort()).toEqual([
      "urkundenwerk_create_draft",
      "urkundenwerk_delete_draft",
      "urkundenwerk_export_document",
      "urkundenwerk_get_document",
      "urkundenwerk_list_documents",
      "urkundenwerk_list_firms",
      "urkundenwerk_update_draft",
      "urkundenwerk_validate_document",
    ]);
    for (const tool of tools) {
      expect(tool.outputSchema, tool.name).toBeDefined();
      expect(tool.annotations?.openWorldHint, tool.name).toBe(false);
    }
    expect(
      byName.urkundenwerk_validate_document?.annotations?.readOnlyHint,
    ).toBe(true);
    expect(byName.urkundenwerk_create_draft?.annotations?.readOnlyHint).toBe(
      false,
    );
    expect(byName.urkundenwerk_delete_draft?.annotations?.destructiveHint).toBe(
      true,
    );
    expect(byName.urkundenwerk_export_document?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    });
    expect(byName.urkundenwerk_create_draft?.description).toContain(
      "never by you",
    );
  });
});

describe("tenant selection", () => {
  it("uses the only firm when no tenant is given", async () => {
    store.add({ tenantId: NORD.tenantId, data: {}, title: "Nord draft" });
    const { call } = await start();
    const { isError, data } = await call("urkundenwerk_list_documents");
    expect(isError).toBe(false);
    expect(data.firm.slug).toBe("demo-kanzlei-nord");
    expect(data.documents.map((d: { title: string }) => d.title)).toEqual([
      "Nord draft",
    ]);
  });

  it("asks for a tenant and lists the firms when there are several", async () => {
    store.memberships = [NORD, SUED];
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_list_documents");
    expect(isError).toBe(true);
    expect(text).toContain('Pass "tenant"');
    expect(text).toContain('"demo-kanzlei-nord" (Demo-Kanzlei Nord, editor)');
    expect(text).toContain('"demo-kanzlei-sued" (Demo-Kanzlei Süd, viewer)');
  });

  it("accepts a slug or a tenant id", async () => {
    store.memberships = [NORD, SUED];
    const { call } = await start();
    expect(
      (
        await call("urkundenwerk_list_documents", {
          tenant: "demo-kanzlei-sued",
        })
      ).data.firm.name,
    ).toBe("Demo-Kanzlei Süd");
    expect(
      (await call("urkundenwerk_list_documents", { tenant: NORD.tenantId }))
        .data.firm.slug,
    ).toBe("demo-kanzlei-nord");
  });

  it("refuses firms the user does not belong to", async () => {
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_list_documents", {
      tenant: "demo-kanzlei-sued",
    });
    expect(isError).toBe(true);
    expect(text).toContain('not a member of a firm "demo-kanzlei-sued"');
  });

  it("explains what to do without any membership", async () => {
    store.memberships = [];
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_create_draft", {});
    expect(isError).toBe(true);
    expect(text).toContain("not a member of any firm");
  });

  it("lists firms with roles", async () => {
    store.memberships = [NORD, SUED];
    const { call } = await start();
    const { data } = await call("urkundenwerk_list_firms");
    expect(data.firms).toEqual([
      {
        tenantId: NORD.tenantId,
        slug: NORD.slug,
        name: NORD.name,
        role: "editor",
        canEdit: true,
      },
      {
        tenantId: SUED.tenantId,
        slug: SUED.slug,
        name: SUED.name,
        role: "viewer",
        canEdit: false,
      },
    ]);
  });
});

describe("list_documents", () => {
  it("paginates and reports completeness", async () => {
    store.add({
      tenantId: NORD.tenantId,
      data: COMPLETE_DRAFT,
      title: "Complete",
    });
    store.add({ tenantId: NORD.tenantId, data: {}, title: "Empty" });
    store.add({
      tenantId: NORD.tenantId,
      data: {},
      title: "Other",
      templateId: "handelsregisteranmeldung",
    });
    const { call } = await start();

    const first = await call("urkundenwerk_list_documents", { limit: 2 });
    expect(first.data).toMatchObject({
      total: 3,
      count: 2,
      offset: 0,
      hasMore: true,
      nextOffset: 2,
    });
    expect(first.data.documents[0]).toMatchObject({
      title: "Other",
      completeness: null,
    });
    expect(first.data.documents[1].completeness).toMatchObject({
      ready: false,
    });
    expect(
      first.data.documents[1].completeness.outstandingFields,
    ).toBeGreaterThan(5);

    const second = await call("urkundenwerk_list_documents", {
      limit: 2,
      offset: 2,
    });
    expect(second.data).toMatchObject({ count: 1, hasMore: false });
    expect(second.data.nextOffset).toBeUndefined();
    expect(second.data.documents[0]).toMatchObject({
      title: "Complete",
      completeness: { ready: true, errors: 0, outstandingFields: 0 },
    });
  });
});

describe("create_draft", () => {
  it("applies the builder's defaults and takes the Firma as title", async () => {
    const { call } = await start();
    const { isError, data } = await call("urkundenwerk_create_draft", {
      data: {
        company: { name: "Beispiel Bau GmbH" },
        shareCapitalCents: 2_500_000,
      },
    });
    expect(isError).toBe(false);
    expect(data.document.title).toBe("Beispiel Bau GmbH");
    expect(data.document.data).toEqual({
      company: { name: "Beispiel Bau GmbH" },
      shareCapitalCents: 2_500_000,
      notarisation: { mode: "in_person" },
      founder: { kind: "natural_person" },
      managingDirector: { kind: "founder" },
    });
    expect(data.document.firm.slug).toBe("demo-kanzlei-nord");
    expect(data.document.completeness.ready).toBe(false);
    expect(store.documents.size).toBe(1);
  });

  it("uses an explicit title or the default", async () => {
    const { call } = await start();
    expect(
      (await call("urkundenwerk_create_draft", { title: "  Akte 7  " })).data
        .document.title,
    ).toBe("Akte 7");
    expect(
      (await call("urkundenwerk_create_draft", {})).data.document.title,
    ).toBe("Untitled Musterprotokoll");
  });

  it("rejects data that does not match the draft schema", async () => {
    const { call } = await start();
    const unknownKey = await call("urkundenwerk_create_draft", {
      data: { company: { firma: "X" } },
    });
    expect(unknownKey.isError).toBe(true);
    expect(unknownKey.text).toMatch(/firma/);

    const badAmount = await call("urkundenwerk_create_draft", {
      data: { shareCapitalCents: 12.5 },
    });
    expect(badAmount.isError).toBe(true);
    expect(store.documents.size).toBe(0);
  });

  it("refuses viewers with a friendly message", async () => {
    store.memberships = [{ ...NORD, role: "viewer" }];
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_create_draft", {
      title: "Nope",
    });
    expect(isError).toBe(true);
    expect(text).toContain("Your role in Demo-Kanzlei Nord is viewer");
    expect(store.documents.size).toBe(0);
  });

  it("reports a refusal by row-level security as a role error", async () => {
    store.insertDocument = async () => null;
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_create_draft", {});
    expect(isError).toBe(true);
    expect(text).toContain("does not allow creating documents");
  });
});

describe("update_draft", () => {
  it("merges a nested filing patch and returns the saved filing on read", async () => {
    const { call } = await start();
    const create = await call("urkundenwerk_create_draft", {
      data: { ...COMPLETE_DRAFT, filing: COMPLETE_FILING },
    });
    expect(create.isError, create.text).toBe(false);
    expect(create.data.document.data.filing).toEqual(COMPLETE_FILING);
    const { documentId } = create.data.document;

    const update = await call("urkundenwerk_update_draft", {
      documentId,
      patch: { filing: { businessAddress: { street: "Beispielweg 3" } } },
    });
    expect(update.isError, update.text).toBe(false);

    const invalid = await call("urkundenwerk_update_draft", {
      documentId,
      patch: { filing: { paidCents: 12.5 } },
    });
    expect(invalid.isError).toBe(true);
    expect(invalid.text).toContain("paidCents");

    const read = await call("urkundenwerk_get_document", { documentId });
    expect(read.data.document.data).toEqual({
      ...COMPLETE_DRAFT,
      filing: {
        ...COMPLETE_FILING,
        businessAddress: {
          ...COMPLETE_FILING.businessAddress,
          street: "Beispielweg 3",
        },
      },
    });
  });

  it("deep-merges the patch and keeps sibling fields", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: {
        founder: {
          kind: "natural_person",
          firstName: "Erika",
          address: { city: "Musterstadt" },
        },
      },
    });
    const { call } = await start();
    const { isError, data } = await call("urkundenwerk_update_draft", {
      documentId: document.id,
      patch: {
        founder: {
          lastName: "Mustermann",
          salutation: null,
          address: { street: "Musterweg 1" },
        },
      },
    });
    expect(isError).toBe(false);
    expect(data.document.data.founder).toEqual({
      kind: "natural_person",
      firstName: "Erika",
      lastName: "Mustermann",
      salutation: null,
      address: { city: "Musterstadt", street: "Musterweg 1" },
    });
  });

  it("removes fields listed in unset and renames", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: { notaryNotes: "Hinweis", company: { name: "A GmbH", seat: "B" } },
    });
    const { call } = await start();
    const { data } = await call("urkundenwerk_update_draft", {
      documentId: document.id,
      unset: ["notaryNotes", "company.seat", "founder.address.street"],
      title: "Renamed",
    });
    expect(data.document.title).toBe("Renamed");
    expect(data.document.data).toEqual({ company: { name: "A GmbH" } });
  });

  it("validates the merged draft before saving", async () => {
    const document = store.add({ tenantId: NORD.tenantId, data: {} });
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_update_draft", {
      documentId: document.id,
      patch: { founder: { birthDate: "1990-02-30" } },
    });
    expect(isError).toBe(true);
    expect(text).toMatch(/birthDate/);
    expect(store.documents.get(document.id)?.data).toEqual({});
  });

  it("requires a change", async () => {
    const document = store.add({ tenantId: NORD.tenantId, data: {} });
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_update_draft", {
      documentId: document.id,
    });
    expect(isError).toBe(true);
    expect(text).toContain("Nothing to change");
  });

  it("refuses viewers", async () => {
    store.memberships = [NORD, SUED];
    const document = store.add({ tenantId: SUED.tenantId, data: {} });
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_update_draft", {
      documentId: document.id,
      patch: { notaryNotes: "x" },
    });
    expect(isError).toBe(true);
    expect(text).toContain("Your role in Demo-Kanzlei Süd is viewer");
  });

  it("does not overwrite a concurrent change", async () => {
    const document = store.add({ tenantId: NORD.tenantId, data: {} });
    const getDocument = store.getDocument.bind(store);
    let reads = 0;
    store.getDocument = async (id) => {
      const result = await getDocument(id);
      reads += 1;
      // Someone else saves right after the tool read the document.
      if (reads === 1)
        await store.updateDocument(id, { title: "Changed elsewhere" });
      return result;
    };
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_update_draft", {
      documentId: document.id,
      patch: { notaryNotes: "x" },
    });
    expect(isError).toBe(true);
    expect(text).toContain("changed while it was being updated");
    expect(store.documents.get(document.id)?.data).toEqual({});
  });
});

describe("get_document and isolation", () => {
  it("returns data, firm, and completeness", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: COMPLETE_DRAFT,
      title: "Complete",
    });
    const { call } = await start();
    const { data } = await call("urkundenwerk_get_document", {
      documentId: document.id,
    });
    expect(data.document).toMatchObject({
      documentId: document.id,
      title: "Complete",
      canEdit: true,
      firm: { slug: "demo-kanzlei-nord" },
      completeness: { ready: true },
    });
    expect(data.document.data.company.name).toBe("Nordmuster Logistik GmbH");
  });

  it("hides documents of other firms", async () => {
    const foreign = store.add({ tenantId: SUED.tenantId, data: {} });
    const { call } = await start();
    for (const tool of [
      "urkundenwerk_get_document",
      "urkundenwerk_validate_document",
      "urkundenwerk_export_document",
      "urkundenwerk_delete_draft",
    ]) {
      const { isError, text } = await call(tool, { documentId: foreign.id });
      expect(isError, tool).toBe(true);
      expect(text, tool).toContain(
        "was not found, or you are not a member of its firm",
      );
    }
    expect(store.documents.has(foreign.id)).toBe(true);
  });

  it("rejects malformed ids before touching the store", async () => {
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_get_document", {
      documentId: "../etc",
    });
    expect(isError).toBe(true);
    expect(text).toMatch(/documentId/);
  });
});

describe("validate_document", () => {
  it("returns rule issues with codes, paths, and legal references", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: { ...COMPLETE_DRAFT, shareCapitalCents: 1_000_000 },
    });
    const { call } = await start();
    const { data } = await call("urkundenwerk_validate_document", {
      documentId: document.id,
    });
    expect(data.referenceDate).toBe(TODAY);
    expect(data.completeness.ready).toBe(false);
    expect(data.issues).toContainEqual({
      code: "gmbh_capital_minimum",
      severity: "error",
      paths: ["shareCapitalCents", "company.name"],
      message: "A GmbH needs a Stammkapital of at least 25.000 €.",
      legalReference: "§ 5 Abs. 1 GmbHG",
    });
  });

  it("uses the reference date for date rules", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: COMPLETE_DRAFT,
    });
    session = await connect({
      context: { store, today: () => "2030-01-01", exportDir: undefined },
    });
    const { data } = await session.call("urkundenwerk_validate_document", {
      documentId: document.id,
    });
    expect(data.issues.map((i: { code: string }) => i.code)).toContain(
      "notarisation_date_plausible",
    );
  });

  it("reports stored data that is no longer a valid draft", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: { unexpected: true },
    });
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_validate_document", {
      documentId: document.id,
    });
    expect(isError).toBe(true);
    expect(text).toContain("not a valid draft");
  });
});

describe("export_document", () => {
  it("only applies filing rules when validating or exporting the filing", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: COMPLETE_DRAFT,
    });
    const { call } = await start();
    const documentId = document.id;

    const deed = await call("urkundenwerk_validate_document", { documentId });
    expect(deed.data.completeness.ready).toBe(true);
    const filing = await call("urkundenwerk_validate_document", {
      documentId,
      document: "anmeldung",
    });
    expect(filing.data.completeness.ready).toBe(false);
    expect(filing.data.issues).toContainEqual({
      code: "filing_court_required",
      severity: "error",
      paths: ["filing.registerCourt"],
      message: "Enter the town of the Amtsgericht.",
      legalReference: "§ 7 Abs. 1 GmbHG",
    });

    for (const format of ["pdf", "docx", "xml"]) {
      const blocked = await call("urkundenwerk_export_document", {
        documentId,
        document: "anmeldung",
        format,
      });
      expect(blocked.isError, format).toBe(true);
      expect(blocked.text).toContain("filing_court_required");
      expect(blocked.result.content).toHaveLength(1);
    }

    const exported = await call("urkundenwerk_export_document", { documentId });
    expect(exported.isError, exported.text).toBe(false);
  });

  it("blocks a filing export when the deed has rule errors", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: {
        ...COMPLETE_DRAFT,
        company: { ...COMPLETE_DRAFT.company, purpose: "" },
        filing: COMPLETE_FILING,
      },
    });
    const { call } = await start();
    const blocked = await call("urkundenwerk_export_document", {
      documentId: document.id,
      format: "xml",
    });
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toContain("company.purpose");
    expect(blocked.result.content).toHaveLength(1);
  });

  it("returns and saves a validated XML resource with a filing filename", async () => {
    exportDir = await mkdtemp(join(tmpdir(), "urkundenwerk-mcp-"));
    const document = store.add({
      tenantId: NORD.tenantId,
      title: "Nordmuster Logistik GmbH",
      data: { ...COMPLETE_DRAFT, filing: COMPLETE_FILING },
    });
    const { call } = await start({ exportDir });
    const exported = await call("urkundenwerk_export_document", {
      documentId: document.id,
      format: "xml",
      saveTo: ".",
    });
    expect(exported.isError, exported.text).toBe(false);
    const filename = "Handelsregisteranmeldung-Nordmuster-Logistik-GmbH.xml";
    expect(exported.data).toMatchObject({
      filename,
      mimeType: "application/xml",
    });
    const resource = exported.result.content?.[1];
    expect(resource).toMatchObject({
      type: "resource",
      resource: {
        uri: `urkundenwerk://documents/${document.id}/export/${filename}`,
        mimeType: "application/xml",
        blob: expect.any(String),
      },
    });
    expect(await readFile(join(exportDir, filename))).toEqual(
      Buffer.from(
        (resource as { resource: { blob: string } }).resource.blob,
        "base64",
      ),
    );

    const incompatible = await call("urkundenwerk_export_document", {
      documentId: document.id,
      document: "musterprotokoll",
      format: "xml",
    });
    expect(incompatible.isError).toBe(true);
  });

  it("keeps rejected XML out of the result and off disk with a fixed diagnostic", async () => {
    const validate = vi
      .spyOn(filingXml, "validateRegisterFilingXml")
      .mockResolvedValue(false);
    exportDir = await mkdtemp(join(tmpdir(), "urkundenwerk-mcp-"));
    const document = store.add({
      tenantId: NORD.tenantId,
      data: { ...COMPLETE_DRAFT, filing: COMPLETE_FILING },
    });
    const log = vi.fn();
    const { call } = await start({ exportDir, log });
    const rejected = await call("urkundenwerk_export_document", {
      documentId: document.id,
      format: "xml",
      saveTo: ".",
    });
    expect(validate).toHaveBeenCalledOnce();
    expect(rejected.isError).toBe(true);
    expect(rejected.text).toContain("internal error");
    expect(rejected.result.content).toHaveLength(1);
    expect(log.mock.calls).toEqual([
      ["Register filing XML generation or validation failed"],
    ]);
    expect(await readdir(exportDir)).toEqual([]);
  });

  it("returns an Anmeldung PDF as an embedded resource", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: { ...COMPLETE_DRAFT, filing: COMPLETE_FILING },
    });
    const { call } = await start();
    const exported = await call("urkundenwerk_export_document", {
      documentId: document.id,
      document: "anmeldung",
    });
    expect(exported.isError, exported.text).toBe(false);
    expect(exported.data.filename).toBe(
      "Handelsregisteranmeldung-Fictional-draft.pdf",
    );
    const { resource } = exported.result.content?.[1] as {
      resource: { blob: string; mimeType: string };
    };
    expect(resource.mimeType).toBe("application/pdf");
    const pdf = Buffer.from(resource.blob, "base64").toString("latin1");
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf).toContain("(Handelsregisteranmeldung)");
  });

  it("refuses incomplete documents and lists the errors", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: { company: { name: "Halb GmbH" } },
    });
    const { call } = await start();
    const { isError, text, result } = await call(
      "urkundenwerk_export_document",
      {
        documentId: document.id,
        format: "pdf",
      },
    );
    expect(isError).toBe(true);
    expect(text).toContain("not ready to export");
    expect(text).toContain('"code":"field_required"');
    expect(result.content).toHaveLength(1);
  });

  it("returns a PDF as an embedded resource", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: COMPLETE_DRAFT,
      title: "Nordmuster Logistik GmbH",
    });
    const { call } = await start();
    const { isError, data, result } = await call(
      "urkundenwerk_export_document",
      { documentId: document.id },
    );
    expect(isError).toBe(false);
    expect(data).toMatchObject({
      format: "pdf",
      filename: "Musterprotokoll-Nordmuster-Logistik-GmbH.pdf",
      mimeType: "application/pdf",
      savedTo: null,
    });
    const resource = (
      result.content as {
        type: string;
        resource?: { blob: string; mimeType: string; uri: string };
      }[]
    ).find((block) => block.type === "resource")?.resource;
    expect(resource?.mimeType).toBe("application/pdf");
    expect(resource?.uri).toBe(data.resourceUri);
    const bytes = Buffer.from(resource!.blob, "base64");
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bytes.byteLength).toBe(data.sizeBytes);
  });

  it("returns a DOCX with its MIME type", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: COMPLETE_DRAFT,
      title: "Süd Ä",
    });
    const { call } = await start();
    const { data, result } = await call("urkundenwerk_export_document", {
      documentId: document.id,
      format: "docx",
    });
    expect(data.filename).toBe("Musterprotokoll-Sued-Ae.docx");
    expect(data.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const blob = (
      result.content as { type: string; resource?: { blob: string } }[]
    )[1]?.resource?.blob;
    expect(Buffer.from(blob!, "base64").subarray(0, 2).toString("latin1")).toBe(
      "PK",
    );
  });

  it("lets viewers export", async () => {
    store.memberships = [{ ...NORD, role: "viewer" }];
    const document = store.add({
      tenantId: NORD.tenantId,
      data: COMPLETE_DRAFT,
    });
    const { call } = await start();
    expect(
      (await call("urkundenwerk_export_document", { documentId: document.id }))
        .isError,
    ).toBe(false);
  });

  it("saves to the export directory only when configured", async () => {
    const document = store.add({
      tenantId: NORD.tenantId,
      data: COMPLETE_DRAFT,
      title: "Akte",
    });
    const { call } = await start();
    const { isError, text } = await call("urkundenwerk_export_document", {
      documentId: document.id,
      saveTo: ".",
    });
    expect(isError).toBe(true);
    expect(text).toContain("URKUNDENWERK_EXPORT_DIR");
  });

  it("writes below the export directory and guards against traversal", async () => {
    exportDir = await mkdtemp(join(tmpdir(), "urkundenwerk-mcp-"));
    const document = store.add({
      tenantId: NORD.tenantId,
      data: COMPLETE_DRAFT,
      title: "Akte",
    });
    const { call } = await start({ exportDir });

    const saved = await call("urkundenwerk_export_document", {
      documentId: document.id,
      saveTo: "nord/2026",
    });
    expect(saved.isError).toBe(false);
    expect(saved.data.savedTo).toBe(
      join(exportDir, "nord", "2026", "Musterprotokoll-Akte.pdf"),
    );
    expect(
      (await readFile(saved.data.savedTo)).subarray(0, 5).toString("latin1"),
    ).toBe("%PDF-");

    const again = await call("urkundenwerk_export_document", {
      documentId: document.id,
      saveTo: "nord/2026",
    });
    expect(again.isError).toBe(true);
    expect(again.text).toContain("overwrite: true");
    const replaced = await call("urkundenwerk_export_document", {
      documentId: document.id,
      saveTo: "nord/2026",
      overwrite: true,
    });
    expect(replaced.isError).toBe(false);

    for (const saveTo of [
      "..",
      "../outside",
      "nord/../../outside",
      join(tmpdir(), "abs"),
      "C:\\temp",
    ]) {
      const { isError, text } = await call("urkundenwerk_export_document", {
        documentId: document.id,
        saveTo,
      });
      expect(isError, saveTo).toBe(true);
      expect(text, saveTo).toMatch(/saveTo must/);
    }
  });
});

describe("delete_draft", () => {
  it("deletes for editors and refuses viewers", async () => {
    store.memberships = [NORD, SUED];
    const own = store.add({
      tenantId: NORD.tenantId,
      data: {},
      title: "Weg damit",
    });
    const viewerOnly = store.add({ tenantId: SUED.tenantId, data: {} });
    const { call } = await start();

    expect(
      (await call("urkundenwerk_delete_draft", { documentId: own.id })).data,
    ).toEqual({
      deleted: true,
      documentId: own.id,
      title: "Weg damit",
    });
    expect(store.documents.has(own.id)).toBe(false);

    const refused = await call("urkundenwerk_delete_draft", {
      documentId: viewerOnly.id,
    });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("does not allow deleting documents");
    expect(store.documents.has(viewerOnly.id)).toBe(true);
  });
});

describe("errors and session", () => {
  it("reports store failures by code without database messages", async () => {
    store.listMemberships = async () => {
      throw new StoreError("load your firms", "PGRST301");
    };
    const logs: string[] = [];
    session = await connect({
      context: { store, today: () => TODAY, exportDir: undefined },
      log: (message) => logs.push(message),
    });
    const { isError, text } = await session.call("urkundenwerk_list_firms");
    expect(isError).toBe(true);
    expect(text).toContain(
      "Could not load your firms. The database reported error PGRST301.",
    );
    expect(logs).toEqual(["store error PGRST301: Could not load your firms."]);
  });

  it("hides unexpected errors behind a generic message", async () => {
    store.listMemberships = async () => {
      throw new Error("Erika Mustermann, Musterweg 12");
    };
    const logs: string[] = [];
    session = await connect({
      context: { store, today: () => TODAY, exportDir: undefined },
      log: (message) => logs.push(message),
    });
    const { text } = await session.call("urkundenwerk_list_firms");
    expect(text).not.toContain("Erika");
    expect(logs.join("\n")).not.toContain("Erika");
  });

  it("renews the session before every tool call", async () => {
    let renewals = 0;
    session = await connect({
      context: { store, today: () => TODAY, exportDir: undefined },
      ensureSession: async () => {
        renewals += 1;
      },
    });
    await session.call("urkundenwerk_list_firms");
    await session.call("urkundenwerk_list_documents");
    expect(renewals).toBe(2);
  });
});

describe("resources and prompts", () => {
  it("serves the draft schema and the rule list", async () => {
    const { client } = await start();
    const schema = await client.readResource({ uri: DRAFT_SCHEMA_URI });
    const parsed = JSON.parse((schema.contents[0] as { text: string }).text);
    expect(parsed.properties.shareCapitalCents.type).toBe("integer");
    expect(parsed.additionalProperties).toBe(false);
    expect(parsed.properties.filing.properties.paidCents.type).toBe("integer");

    const rules = JSON.parse(
      (
        (await client.readResource({ uri: RULES_URI })).contents[0] as {
          text: string;
        }
      ).text,
    );
    expect(rules.rules).toContainEqual(
      expect.objectContaining({
        code: "gmbh_capital_minimum",
        legalReference: expect.stringContaining("GmbHG"),
      }),
    );
  });

  it("offers a prompt that forbids writing legal text", async () => {
    const { client } = await start();
    const prompt = await client.getPrompt({
      name: "prepare_musterprotokoll",
      arguments: {
        facts: "Fictional founder Max Beispiel founds Beispiel GmbH.",
      },
    });
    const text = (prompt.messages[0]?.content as { text: string }).text;
    expect(text).toContain("Do not write or rephrase legal text");
    expect(text).toContain("Max Beispiel");
  });
});
