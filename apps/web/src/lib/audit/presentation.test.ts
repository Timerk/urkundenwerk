import { describe, expect, it } from "vitest";
import {
  changedFields,
  importTotals,
  personLabel,
  toAuditEntry,
  type AuditEventRow,
} from "./presentation";

const row: AuditEventRow = {
  id: "event",
  action: "document.updated",
  actor_id: "actor",
  subject_user_id: null,
  entity_type: "document",
  entity_id: "draft",
  occurred_at: "2026-11-24T10:00:00Z",
  metadata: { fields: ["company.name", "title"] },
};

describe("audit presentation", () => {
  it("prefers the display name and exposes changed paths rather than values", () => {
    const people = new Map([
      [
        "actor",
        {
          userId: "actor",
          displayName: " Beispielfigur ",
          email: "figure@example.test",
        },
      ],
    ]);
    const entry = toAuditEntry(row, people)!;
    expect(entry.actor).toMatchObject({
      kind: "person",
      name: "Beispielfigur",
    });
    expect(changedFields(entry)).toEqual(["company.name", "title"]);
    expect(personLabel(null, people)).toEqual({ kind: "none" });
    expect(personLabel("another", people)).toEqual({ kind: "former" });
    expect(
      personLabel(
        "actor",
        new Map([
          [
            "actor",
            { userId: "actor", displayName: " ", email: "figure@example.test" },
          ],
        ]),
      ),
    ).toMatchObject({ name: "figure@example.test" });
  });

  it("keeps a known event with malformed details and skips unknown actions", () => {
    expect(
      toAuditEntry({ ...row, metadata: { fields: [7] } }, new Map())?.details,
    ).toBeNull();
    expect(
      toAuditEntry({ ...row, action: "document.future" }, new Map()),
    ).toBeNull();
  });

  it("sums import decisions across all source statuses", () => {
    expect(
      importTotals({
        verified: { accepted: 4, edited: 2, cleared: 0 },
        unverified: { accepted: 1, edited: 3, cleared: 1 },
        absent: { accepted: 0, edited: 2, cleared: 2 },
      }),
    ).toEqual({ accepted: 5, edited: 7, cleared: 3 });
  });
});
