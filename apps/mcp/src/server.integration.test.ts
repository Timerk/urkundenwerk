import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseConfig } from "./config";
import { todayInGermany } from "./domain";
import { signIn, type UserSession } from "./session";
import { createSupabaseStore } from "./store";
import { connect } from "./test/client";

/*
 * End-to-end through the MCP protocol against the local Supabase stack:
 * real sign-in, real PostgREST queries, and real RLS. Requires
 * `pnpm db:start`; locally the URL and key come from `pnpm db:env`.
 */

const envFile = fileURLToPath(new URL("../../web/.env.local", import.meta.url));
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

// Fictional seed users; the password exists only in supabase/seed.sql.
const DEMO_PASSWORD = "demo-password-123";
const NORD_DOCUMENT = "00000000-0000-4000-8000-0000000d0a01";

type Connection = Awaited<ReturnType<typeof connect>>;
const open: { session: UserSession; connection: Connection }[] = [];

async function as(email: string): Promise<Connection> {
  const config = parseConfig({
    ...process.env,
    URKUNDENWERK_EMAIL: email,
    URKUNDENWERK_PASSWORD: DEMO_PASSWORD,
  });
  const session = await signIn(config);
  const connection = await connect({
    context: {
      store: createSupabaseStore(session.client, session.userId),
      today: () => todayInGermany(),
      exportDir: undefined,
    },
    ensureSession: () => session.ensureActive(),
  });
  open.push({ session, connection });
  return connection;
}

function daysAgo(days: number): string {
  const date = new Date(`${todayInGermany()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** The facts the first test adds to make its draft complete. */
function missingFacts() {
  return {
    notarisation: {
      deedNumber: "7/2026",
      date: daysAgo(2),
      notaryName: "Dr. Nora Musterfrau",
      notarySeat: "Musterstadt",
    },
    founder: {
      salutation: "Herr",
      firstName: "Max",
      lastName: "Beispiel",
      birthDate: "1985-04-12",
      address: {
        street: "Beispielweg 3",
        postalCode: "12345",
        city: "Musterstadt",
      },
    },
    contribution: "full",
  };
}

const COMPANY = {
  company: {
    name: "Integrationstest Werkstatt GmbH",
    seat: "Musterstadt",
    purpose: "die Reparatur und den Handel mit Fahrrädern",
  },
  shareCapitalCents: 2_500_000,
};

const created: string[] = [];
let editor: Connection;

beforeAll(async () => {
  editor = await as("erik.editor@demo.test");
});

afterAll(async () => {
  for (const documentId of created) {
    await editor.call("urkundenwerk_delete_draft", { documentId });
  }
  for (const { session, connection } of open) {
    await connection.close();
    await session.close();
  }
});

describe("MCP server against local Supabase", () => {
  it("creates, updates, validates, and exports a draft as PDF", async () => {
    const create = await editor.call("urkundenwerk_create_draft", {
      data: COMPANY,
    });
    expect(create.isError, create.text).toBe(false);
    const documentId: string = create.data.document.documentId;
    created.push(documentId);
    expect(create.data.document).toMatchObject({
      title: "Integrationstest Werkstatt GmbH",
      firm: { slug: "demo-kanzlei-nord" },
      canEdit: true,
      completeness: { ready: false },
    });

    const blocked = await editor.call("urkundenwerk_export_document", {
      documentId,
    });
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toContain("field_required");

    const update = await editor.call("urkundenwerk_update_draft", {
      documentId,
      patch: missingFacts(),
    });
    expect(update.isError, update.text).toBe(false);
    expect(update.data.document.data.company.name).toBe(
      "Integrationstest Werkstatt GmbH",
    );

    const validation = await editor.call("urkundenwerk_validate_document", {
      documentId,
    });
    expect(validation.isError).toBe(false);
    expect(validation.data.completeness.ready).toBe(true);
    expect(
      validation.data.issues.filter(
        (i: { severity: string }) => i.severity === "error",
      ),
    ).toEqual([]);

    const exported = await editor.call("urkundenwerk_export_document", {
      documentId,
      format: "pdf",
    });
    expect(exported.isError, exported.text).toBe(false);
    expect(exported.data.filename).toBe(
      "Musterprotokoll-Integrationstest-Werkstatt-GmbH.pdf",
    );
    const resource = (
      exported.result.content as {
        type: string;
        resource?: { blob: string; mimeType: string };
      }[]
    ).find((block) => block.type === "resource")?.resource;
    expect(resource?.mimeType).toBe("application/pdf");
    const pdf = Buffer.from(resource!.blob, "base64");
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.subarray(-6).toString("latin1")).toContain("%%EOF");

    const listed = await editor.call("urkundenwerk_list_documents", {
      limit: 100,
    });
    expect(listed.data.documents).toContainEqual(
      expect.objectContaining({
        documentId,
        completeness: expect.objectContaining({ ready: true }),
      }),
    );
  });

  it("does not let a viewer create a draft", async () => {
    const viewer = await as("victor.viewer@demo.test");
    const before = await viewer.call("urkundenwerk_list_documents");
    const result = await viewer.call("urkundenwerk_create_draft", {
      title: "Viewer draft",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Your role in Demo-Kanzlei Nord is viewer");
    expect((await viewer.call("urkundenwerk_list_documents")).data.total).toBe(
      before.data.total,
    );

    // Viewers still read and export their firm's documents.
    const draft = await editor.call("urkundenwerk_create_draft", {
      title: "Viewer export",
      data: { ...COMPANY, ...missingFacts() },
    });
    created.push(draft.data.document.documentId);
    const exported = await viewer.call("urkundenwerk_export_document", {
      documentId: draft.data.document.documentId,
      format: "docx",
    });
    expect(exported.isError, exported.text).toBe(false);
  });

  it("lets row-level security refuse a write the role check did not catch", async () => {
    // Mia is a viewer in Süd; the RLS policy refuses even when the client asks directly.
    const config = parseConfig({
      ...process.env,
      URKUNDENWERK_EMAIL: "mia.multi@demo.test",
      URKUNDENWERK_PASSWORD: DEMO_PASSWORD,
    });
    const session = await signIn(config);
    try {
      const store = createSupabaseStore(session.client, session.userId);
      const refused = await store.insertDocument({
        tenantId: "00000000-0000-4000-8000-0000000000bb",
        templateId: "musterprotokoll-einpersonen",
        templateVersion: "2022-08-01",
        title: "Bypass attempt",
        data: {},
      });
      expect(refused).toBeNull();
    } finally {
      await session.close();
    }
  });

  it("keeps Demo-Kanzlei Süd out of Nord's documents", async () => {
    const sued = await as("sara.admin@demo.test");

    const firms = await sued.call("urkundenwerk_list_firms");
    expect(firms.data.firms.map((f: { slug: string }) => f.slug)).toEqual([
      "demo-kanzlei-sued",
    ]);

    const read = await sued.call("urkundenwerk_get_document", {
      documentId: NORD_DOCUMENT,
    });
    expect(read.isError).toBe(true);
    expect(read.text).toContain(
      "was not found, or you are not a member of its firm",
    );

    const list = await sued.call("urkundenwerk_list_documents", {
      tenant: "demo-kanzlei-nord",
    });
    expect(list.isError).toBe(true);

    const update = await sued.call("urkundenwerk_update_draft", {
      documentId: NORD_DOCUMENT,
      patch: { notaryNotes: "Fremdzugriff" },
    });
    expect(update.isError).toBe(true);

    const ownDocuments = await sued.call("urkundenwerk_list_documents");
    const ids = ownDocuments.data.documents.map(
      (d: { documentId: string }) => d.documentId,
    );
    expect(ids).toContain("00000000-0000-4000-8000-0000000d0b01");
    expect(ids).not.toContain(NORD_DOCUMENT);
  });

  it("asks a member of several firms to choose one", async () => {
    const mia = await as("mia.multi@demo.test");
    const result = await mia.call("urkundenwerk_create_draft", {});
    expect(result.isError).toBe(true);
    expect(result.text).toContain(
      '"demo-kanzlei-nord" (Demo-Kanzlei Nord, editor)',
    );
    expect(result.text).toContain(
      '"demo-kanzlei-sued" (Demo-Kanzlei Süd, viewer)',
    );

    const sued = await mia.call("urkundenwerk_create_draft", {
      tenant: "demo-kanzlei-sued",
    });
    expect(sued.isError).toBe(true);
    expect(sued.text).toContain("Your role in Demo-Kanzlei Süd is viewer");
  });
});
