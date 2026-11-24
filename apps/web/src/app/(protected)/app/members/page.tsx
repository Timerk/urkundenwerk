import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "../../../../components/page-header";
import { Notice } from "../../../../components/ui/notice";
import { formatDateTime } from "../../../../i18n/format";
import { listTenantMembers } from "../../../../lib/audit/repository";
import { createClient, getVerifiedUser } from "../../../../lib/supabase/server";
import { memberRole } from "../../../../lib/tenants/invitations";
import { getCurrentMembership } from "../../../../lib/tenants/memberships";
import {
  InvitationForm,
  MemberRow,
  MembersAnnouncer,
  PersonLabel,
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("members");
  return { title: `${t("title")} · Urkundenwerk` };
}

export default async function MembersPage() {
  const firm = await getCurrentMembership();
  if (!firm) notFound();
  const client = await createClient();
  const isAdmin = firm.role === "admin";
  const [t, roles, locale, user, people, pending] = await Promise.all([
    getTranslations("members"),
    getTranslations("roles"),
    getLocale(),
    getVerifiedUser(),
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
  const nameOf = (person: (typeof people)[number]) =>
    person.display_name?.trim() || person.email || t("unknown");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <PageHeader
        title={t("title")}
        description={t("intro", { firm: firm.name, count: people.length })}
      />
      <MembersAnnouncer>
        <section aria-labelledby="people-heading" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2
              id="people-heading"
              className="text-sm font-medium text-ink-soft"
            >
              {t("people")}
            </h2>
          </div>
          {isAdmin ? null : (
            <Notice title={t("readOnlyTitle")}>{t("readOnlyBody")}</Notice>
          )}
          <ul
            aria-labelledby="people-heading"
            className="divide-y divide-rule rounded-md border border-rule bg-paper"
          >
            {people.map((person) =>
              isAdmin ? (
                <MemberRow
                  key={person.user_id}
                  tenantId={firm.tenantId}
                  firmName={firm.name}
                  userId={person.user_id}
                  role={person.role}
                  isSelf={person.user_id === user?.id}
                  name={nameOf(person)}
                  email={person.email}
                />
              ) : (
                <li
                  key={person.user_id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:px-5"
                >
                  <PersonLabel
                    name={nameOf(person)}
                    email={person.email}
                    isSelf={person.user_id === user?.id}
                  />
                  <span className="text-sm text-ink-soft">
                    {roles(person.role)}
                  </span>
                </li>
              ),
            )}
          </ul>
        </section>

        {isAdmin ? (
          <section
            aria-labelledby="invitations-heading"
            className="grid gap-x-10 gap-y-8 border-t border-rule pt-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h2
                  id="invitations-heading"
                  className="text-lg font-semibold tracking-tight"
                >
                  {t("invitations")}
                </h2>
                <p className="text-sm text-ink-soft">{t("inviteHelp")}</p>
                <p className="text-sm text-ink-faint">{t("inviteDemo")}</p>
              </div>
              <InvitationForm tenantId={firm.tenantId} />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-ink-soft">
                {t("pending")}
              </h3>
              {invites.length ? (
                <ul className="divide-y divide-rule rounded-md border border-rule bg-paper">
                  {invites.map((invite) => (
                    <li
                      key={invite.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1 basis-48 [overflow-wrap:anywhere]">
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-ink-soft">
                          {t("pendingDetails", {
                            role: roles(invite.role),
                            date: formatDateTime(locale, invite.expires_at),
                          })}
                        </p>
                      </div>
                      <RevokeInvitationForm
                        tenantId={firm.tenantId}
                        id={invite.id}
                        email={invite.email}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-md border border-dashed border-rule-strong px-4 py-6 text-center">
                  <p className="font-serif text-lg">{t("noPending")}</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">
                    {t("noPendingHelp")}
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : null}
      </MembersAnnouncer>
    </div>
  );
}
