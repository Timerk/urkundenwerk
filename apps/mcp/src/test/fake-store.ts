import { type FilingDraft, musterprotokollMetadata } from "@urkundenwerk/core";
import type { DocumentStore, Membership, StoredDocument } from "../store";

export const NORD: Membership = {
  tenantId: "00000000-0000-4000-8000-0000000000aa",
  name: "Demo-Kanzlei Nord",
  slug: "demo-kanzlei-nord",
  role: "editor",
};

export const SUED: Membership = {
  tenantId: "00000000-0000-4000-8000-0000000000bb",
  name: "Demo-Kanzlei Süd",
  slug: "demo-kanzlei-sued",
  role: "viewer",
};

/** A complete, fictional Musterprotokoll that passes every rule on 2026-11-23. */
export const COMPLETE_DRAFT = {
  notarisation: {
    mode: "in_person",
    deedNumber: "42/2026",
    date: "2026-11-20",
    notaryName: "Dr. Nora Musterfrau",
    notarySeat: "Musterstadt",
  },
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
    purpose: "die Planung und Vermittlung von Logistikdienstleistungen",
  },
  shareCapitalCents: 2_500_000,
  contribution: "full",
  managingDirector: { kind: "founder" },
} as const;

export const COMPLETE_FILING = {
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
} satisfies FilingDraft;

/**
 * An in-memory store that applies the same role rules as the RLS policies:
 * members read their firms' documents, editors and admins write them.
 */
export class FakeStore implements DocumentStore {
  documents = new Map<string, StoredDocument>();
  private clock = Date.parse("2026-11-23T09:00:00Z");
  private sequence = 0;

  constructor(public memberships: Membership[] = [NORD]) {}

  private member(tenantId: string) {
    return this.memberships.find((m) => m.tenantId === tenantId);
  }

  private canWrite(tenantId: string) {
    const role = this.member(tenantId)?.role;
    return role === "admin" || role === "editor";
  }

  private tick() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  add(
    values: Partial<StoredDocument> & { tenantId: string; data: unknown },
  ): StoredDocument {
    const now = this.tick();
    this.sequence += 1;
    const document: StoredDocument = {
      id: `00000000-0000-4000-8000-${String(this.sequence).padStart(12, "0")}`,
      templateId: musterprotokollMetadata.id,
      templateVersion: musterprotokollMetadata.version,
      title: "Fictional draft",
      status: "draft",
      createdAt: now,
      updatedAt: now,
      ...values,
    };
    this.documents.set(document.id, document);
    return document;
  }

  async listMemberships() {
    return [...this.memberships];
  }

  async listDocuments(
    tenantId: string,
    { limit, offset }: { limit: number; offset: number },
  ) {
    const visible = [...this.documents.values()]
      .filter((d) => d.tenantId === tenantId && this.member(tenantId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      total: visible.length,
      documents: visible.slice(offset, offset + limit),
    };
  }

  async getDocument(id: string) {
    const document = this.documents.get(id);
    return document && this.member(document.tenantId)
      ? structuredClone(document)
      : null;
  }

  async insertDocument(values: Parameters<DocumentStore["insertDocument"]>[0]) {
    if (!this.canWrite(values.tenantId)) return null;
    return this.add(values);
  }

  async updateDocument(
    id: string,
    changes: Parameters<DocumentStore["updateDocument"]>[1],
    expectedUpdatedAt?: string,
  ) {
    const document = this.documents.get(id);
    if (!document || !this.canWrite(document.tenantId)) return null;
    if (expectedUpdatedAt && document.updatedAt !== expectedUpdatedAt)
      return null;
    const updated = { ...document, ...changes, updatedAt: this.tick() };
    this.documents.set(id, updated);
    return structuredClone(updated);
  }

  async deleteDocument(id: string) {
    const document = this.documents.get(id);
    if (!document || !this.canWrite(document.tenantId)) return false;
    return this.documents.delete(id);
  }
}
