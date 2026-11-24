import { expect, it } from "vitest";
import { accountExport } from "./account";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const date = "2026-11-24T09:00:00+00:00";
const data = {
  profile: {
    id,
    email: "member@example.test",
    displayName: null,
    createdAt: date,
  },
  memberships: [],
  invitationsSent: [
    {
      id,
      tenantId: id,
      role: "viewer",
      createdAt: date,
      expiresAt: date,
      acceptedAt: null,
      revokedAt: null,
      email: "invitee@example.test",
      tokenHash: "dummy",
    },
  ],
  auditEvents: [
    {
      id,
      tenantId: id,
      actorId: id,
      action: "membership.added",
      entityType: "membership",
      entityId: null,
      occurredAt: date,
      metadata: { role: "viewer" },
      subjectUserId: other,
    },
  ],
  documentsCreated: [
    { id, title: "Fictional draft", data: { founder: "Fictional Person" } },
  ],
};

it("only serialises the intended columns and excludes other people's details", () => {
  const result = JSON.stringify(accountExport.parse(data));
  expect(result).not.toContain("invitee@example.test");
  expect(result).not.toContain("tokenHash");
  expect(result).not.toContain(other);
  expect(result).not.toContain("Fictional Person");
});

it("refuses to deliver an event attributed to another account", () => {
  const result = accountExport.safeParse({
    ...data,
    auditEvents: [{ ...data.auditEvents[0], actorId: other }],
  });
  expect(result.success).toBe(false);
});
