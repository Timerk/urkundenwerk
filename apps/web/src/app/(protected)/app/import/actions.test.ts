import { readFile } from "node:fs/promises";
import { ExtractionError } from "@urkundenwerk/extraction";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_BYTES } from "../../../../lib/import/limits";

// The actions are tested with auth, memberships, the model call, and the
// database mocked. Ingestion runs for real on a corpus document.
const mocks = vi.hoisted(() => ({
  getVerifiedUser: vi.fn(),
  getMemberships: vi.fn(),
  createClient: vi.fn(async () => ({ rpc: mocks.rpc })),
  rpc: vi.fn(),
  isExtractionEnabled: vi.fn(() => true),
  extract: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect ${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Actions translate their errors in the request's language; English here.
vi.mock("next-intl/server", async () =>
  (await import("../../../../test/i18n")).serverIntl("en"),
);
vi.mock("../../../../lib/supabase/server", () => ({
  getVerifiedUser: mocks.getVerifiedUser,
  createClient: mocks.createClient,
}));
vi.mock("../../../../lib/tenants/memberships", () => ({
  getMemberships: mocks.getMemberships,
}));
vi.mock("../../../../lib/import/extraction", () => ({
  extract: mocks.extract,
  isExtractionEnabled: mocks.isExtractionEnabled,
}));

const { extractContract, createDraftFromImport } = await import("./actions");

const TENANT = "00000000-0000-4000-8000-00000000a001";
const OTHER_TENANT = "00000000-0000-4000-8000-00000000b001";
const pdf = await readFile(
  new URL(
    "../../../../../../../packages/extraction/eval/dev/11-musterprotokoll/document.pdf",
    import.meta.url,
  ),
);

function upload(file?: File, tenantId = TENANT) {
  const form = new FormData();
  form.set("tenantId", tenantId);
  if (file) form.set("file", file);
  return extractContract(form);
}

function sample(id: string, tenantId = TENANT) {
  const form = new FormData();
  form.set("tenantId", tenantId);
  form.set("sampleId", id);
  return extractContract(form);
}

const contractFile = () =>
  new File([pdf], "Musterprotokoll.pdf", { type: "application/pdf" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getVerifiedUser.mockResolvedValue({ id: "user-1" });
  mocks.isExtractionEnabled.mockReturnValue(true);
  mocks.getMemberships.mockResolvedValue([
    { tenantId: TENANT, name: "Demo-Kanzlei Nord", role: "editor" },
    { tenantId: OTHER_TENANT, name: "Demo-Kanzlei Süd", role: "viewer" },
  ]);
  mocks.extract.mockResolvedValue({
    fields: [],
    suspiciousSegments: [],
    model: "fake-model",
    promptVersion: "extract-test",
  });
  mocks.rpc.mockResolvedValue({ data: "doc-1", error: null });
});

describe("extractContract", () => {
  it("rejects an unknown sample before extraction", async () => {
    expect(await sample("../test/13-musterprotokoll/document.pdf")).toEqual({
      ok: false,
      error: "This fictional sample is unavailable.",
    });
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("applies the same editor and AI quota checks to samples", async () => {
    expect(await sample("musterprotokoll", OTHER_TENANT)).toMatchObject({
      ok: false,
      error: /editor or admin/,
    });
    expect(mocks.extract).not.toHaveBeenCalled();
    mocks.extract.mockRejectedValueOnce(new ExtractionError("user_quota"));
    expect(await sample("musterprotokoll")).toMatchObject({
      ok: false,
      error: /import 6 contracts every 10 minutes/,
    });
    mocks.extract.mockRejectedValueOnce(new ExtractionError("daily_budget"));
    expect(await sample("articles")).toMatchObject({
      ok: false,
      error: /daily AI limit/,
    });
  });

  it("returns the ingested text and the review without storing anything", async () => {
    const result = await upload(contractFile());

    expect(result).toMatchObject({
      ok: true,
      contract: {
        fileName: "Musterprotokoll.pdf",
        source: {
          format: "pdf",
          text: expect.stringContaining("Musterprotokoll"),
        },
        model: "fake-model",
        promptVersion: "extract-test",
      },
    });
    expect(mocks.extract).toHaveBeenCalledWith(
      { rpc: mocks.rpc },
      expect.objectContaining({ format: "pdf" }),
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("sends signed-out users to the login page", async () => {
    mocks.getVerifiedUser.mockResolvedValue(null);
    await expect(upload(contractFile())).rejects.toThrow("redirect /login");
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it.each([
    ["a viewer of the firm", OTHER_TENANT],
    ["someone outside the firm", "00000000-0000-4000-8000-00000000c001"],
    ["a malformed firm id", "not-a-uuid"],
  ])("refuses %s", async (_name, tenantId) => {
    expect(await upload(contractFile(), tenantId)).toEqual({
      ok: false,
      error: "Importing contracts needs the editor or admin role in this firm.",
    });
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("reports that AI is not configured", async () => {
    mocks.isExtractionEnabled.mockReturnValue(false);
    expect(await upload(contractFile())).toEqual({
      ok: false,
      error: "AI extraction is not configured on this server.",
    });
  });

  it.each([
    ["no file", undefined, /Choose a PDF or DOCX/u],
    [
      "another file type",
      new File(["hello"], "notes.txt", { type: "text/plain" }),
      /Only PDF and DOCX/u,
    ],
    ["an empty file", new File([], "leer.pdf"), /empty/u],
    [
      "an oversized file",
      new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "gross.pdf"),
      /larger than 4 MB/u,
    ],
  ])("rejects %s before reading it", async (_name, file, message) => {
    const result = await upload(file);
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(message),
    });
  });

  it("maps ingestion errors to friendly messages", async () => {
    const result = await upload(
      new File(["%PDF? not really"], "vertrag.pdf", {
        type: "application/pdf",
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/Only PDF and DOCX/u),
    });
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("reports the per-user rate limit", async () => {
    mocks.extract.mockRejectedValueOnce(new ExtractionError("user_quota"));
    expect(await upload(contractFile())).toEqual({
      ok: false,
      error: "You can import 6 contracts every 10 minutes. Try again shortly.",
    });
  });

  it("shows the extraction error's message", async () => {
    mocks.extract.mockRejectedValue(new ExtractionError("timeout"));
    expect(await upload(contractFile())).toEqual({
      ok: false,
      error: "The AI took too long to answer. Try again in a moment.",
    });
  });

  it("refuses import with the daily budget message when no paid attempt is available", async () => {
    mocks.extract.mockRejectedValue(new ExtractionError("daily_budget"));
    expect(await upload(contractFile())).toEqual({
      ok: false,
      error:
        "The demo has reached its daily AI limit. Try again after midnight UTC.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("createDraftFromImport", () => {
  const draft = {
    company: { name: "Schieferwabe Prüfstände GmbH" },
    shareCapitalCents: 3_500_000,
  };
  const none = { accepted: 0, edited: 0, cleared: 0 };
  const provenance = {
    model: "fake-model",
    promptVersion: "extract-test",
    counts: {
      verified: { accepted: 2, edited: 0, cleared: 0 },
      unverified: none,
      absent: none,
    },
  };

  it("creates a draft titled with the Firma and opens it", async () => {
    await expect(
      createDraftFromImport(TENANT, draft, provenance),
    ).rejects.toThrow("redirect /app/documents/doc-1?imported=1");
    expect(mocks.rpc).toHaveBeenCalledWith("create_imported_document", {
      target_tenant_id: TENANT,
      draft_title: draft.company.name,
      draft_data: draft,
      provenance,
    });
  });

  it("rejects provenance with values or unknown keys", async () => {
    expect(
      await createDraftFromImport(TENANT, draft, {
        ...provenance,
        quotes: ["Schieferwabe"],
      }),
    ).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects data that is not a valid draft", async () => {
    expect(
      await createDraftFromImport(
        TENANT,
        { company: { motto: "x" } },
        provenance,
      ),
    ).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses viewers", async () => {
    expect(
      await createDraftFromImport(OTHER_TENANT, draft, provenance),
    ).toMatchObject({
      ok: false,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
