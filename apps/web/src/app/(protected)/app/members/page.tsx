import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDateTime } from "../../../../i18n/format";
import { listTenantMembers } from "../../../../lib/audit/repository";
import { createClient } from "../../../../lib/supabase/server";
import { memberRole } from "../../../../lib/tenants/invitations";
import { getCurrentMembership } from "../../../../lib/tenants/memberships";
import {
  InvitationForm,
  MembershipForm,
  RevokeInvitationForm,
} from "./member-forms";

const invitations = z.array(
  z.object({
    id: z.uuid(),
    email: z.string(),
    role: memberRole,
    expires_at: z.iso.datetime({ offset: true }),
  }),
);

export default async function MembersPage() {
  const firm = await getCurrentMembership();
  if (!firm) notFound();
  const client = await createClient();
  const isAdmin = firm.role === "admin";
  const [t, roles, locale, people, pending] = await Promise.all([
    getTranslations("members"),
    getTranslations("roles"),
    getLocale(),
    listTenantMembers(client, firm.tenantId),
    isAdmin
      ? client
          .from("tenant_invitations")
          .select("id,email,role,expires_at")
          .eq("tenant_id", firm.tenantId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("expires_at")
      : null,
  ]);
  if (pending?.error) throw new Error("Loading invitations failed.");
  const invites = pending ? invitations.parse(pending.data) : [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-ink-soft">{firm.name}</p>
      </header>
      <ul
        aria-label={t("title")}
        className="divide-y divide-rule rounded-md border border-rule bg-paper px-4"
      >
        {people.map((person) => (
          <li
            key={person.user_id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0 break-words text-sm">
              <p className="font-medium">
                {person.display_name || person.email || t("unknown")}
              </p>
              {person.display_name && person.email ? (
                <p className="text-ink-soft">{person.email}</p>
              ) : null}
            </div>
            {isAdmin ? (
              <MembershipForm
                tenantId={firm.tenantId}
                userId={person.user_id}
                role={person.role}
              />
            ) : (
              <span className="text-sm text-ink-soft">
                {roles(person.role)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {isAdmin ? (
        <section
          aria-labelledby="invitations"
          className="space-y-4 rounded-md border border-rule bg-paper p-4 sm:p-6"
        >
          <h2 id="invitations" className="text-lg font-semibold">
            {t("invitations")}
          </h2>
          <p className="text-sm text-ink-soft">{t("inviteHelp")}</p>
          <InvitationForm tenantId={firm.tenantId} />
          <h3 className="border-t border-rule pt-4 text-sm font-medium">
            {t("pending")}
          </h3>
          {invites.length ? (
            <ul className="divide-y divide-rule">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div className="min-w-0 break-words">
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-ink-soft">
                      {roles(invite.role)} ·{" "}
                      {t("expires", {
                        date: formatDateTime(locale, invite.expires_at),
                      })}
                    </p>
                  </div>
                  <RevokeInvitationForm
                    tenantId={firm.tenantId}
                    id={invite.id}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">{t("noPending")}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
