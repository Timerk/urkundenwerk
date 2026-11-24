import { z } from "zod";
import { auditActionSchema } from "../audit/presentation";
import { memberRole } from "../tenants/invitations";

const date = z.iso.datetime({ offset: true });

export const deletionOptions = z.object({
  protected: z.boolean(),
  soleFirms: z.array(z.object({ id: z.uuid(), name: z.string() })),
});

export const accountExport = z
  .object({
    profile: z.object({
      id: z.uuid(),
      email: z.string().nullable(),
      displayName: z.string().nullable(),
      createdAt: date,
    }),
    memberships: z.array(
      z.object({
        tenantId: z.uuid(),
        name: z.string(),
        role: memberRole,
        joinedAt: date,
      }),
    ),
    invitationsSent: z.array(
      z.object({
        id: z.uuid(),
        tenantId: z.uuid(),
        role: memberRole,
        createdAt: date,
        expiresAt: date,
        acceptedAt: date.nullable(),
        revokedAt: date.nullable(),
      }),
    ),
    auditEvents: z.array(
      z.object({
        id: z.uuid(),
        tenantId: z.uuid(),
        actorId: z.uuid(),
        action: auditActionSchema,
        entityType: z.enum(["document", "membership", "tenant"]),
        entityId: z.uuid().nullable(),
        occurredAt: date,
        metadata: z.record(z.string(), z.unknown()),
      }),
    ),
    documentsCreated: z.array(z.object({ id: z.uuid(), title: z.string() })),
  })
  .superRefine((account, context) => {
    if (
      account.auditEvents.some(({ actorId }) => actorId !== account.profile.id)
    ) {
      context.addIssue({
        code: "custom",
        message: "Unexpected audit actor",
        path: ["auditEvents"],
      });
    }
  });
