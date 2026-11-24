"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormError } from "../../../../components/form-error";
import { Button } from "../../../../components/ui/button";
import { Field, Select, TextInput } from "../../../../components/ui/field";
import {
  memberRole,
  type FormResult,
} from "../../../../lib/tenants/invitations";
import type { TenantRole } from "../../../../lib/tenants/memberships";
import {
  changeMembership,
  createInvitation,
  revokeInvitation,
} from "./actions";

function RoleSelect({ role }: { role: TenantRole }) {
  const t = useTranslations("members");
  const roles = useTranslations("roles");
  return (
    <Field label={t("role")}>
      {(ids) => (
        <Select ids={ids} name="role" defaultValue={role}>
          {memberRole.options.map((value) => (
            <option key={value} value={value}>
              {roles(value)}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function Feedback({ state }: { state: FormResult }) {
  const t = useTranslations("members");
  return (
    <>
      <FormError message={state.error ? t(state.error) : undefined} />
      {state.success ? (
        <p role="status" className="text-sm text-ok">
          {t(state.success)}
        </p>
      ) : null}
    </>
  );
}

export function InvitationForm({ tenantId }: { tenantId: string }) {
  const t = useTranslations("members");
  const [state, action, pending] = useActionState(
    createInvitation.bind(null, tenantId),
    {},
  );
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_minmax(8rem,auto)_auto]">
          <Field label={t("email")}>
            {(ids) => (
              <TextInput
                ids={ids}
                name="email"
                type="email"
                maxLength={254}
                required
                autoComplete="off"
              />
            )}
          </Field>
          <RoleSelect role="viewer" />
          <Button type="submit" disabled={pending}>
            {t("create")}
          </Button>
        </div>
        <Feedback state={state} />
      </form>
      {state.token ? (
        <InvitationLink key={state.token} token={state.token} />
      ) : null}
    </div>
  );
}

function InvitationLink({ token }: { token: string }) {
  const t = useTranslations("members");
  const [message, setMessage] = useState("");
  const link = new URL(`/invite#${token}`, window.location.origin).href;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setMessage(t("copied"));
    } catch {
      setMessage(t("copyManually"));
    }
  }
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-sm border border-rule bg-surface p-3">
      <Field label={t("link")} className="min-w-0 flex-1 basis-56">
        {(ids) => (
          <TextInput
            ids={ids}
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
      </Field>
      <Button variant="secondary" onClick={copy}>
        {t("copy")}
      </Button>
      {message ? (
        <p role="status" className="w-full text-sm text-ink-soft">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function MembershipForm({
  tenantId,
  userId,
  role,
}: {
  tenantId: string;
  userId: string;
  role: TenantRole;
}) {
  const t = useTranslations("members");
  const [state, action, pending] = useActionState(
    changeMembership.bind(null, tenantId, userId),
    {},
  );
  const [confirming, setConfirming] = useState(false);
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <RoleSelect key={role} role={role} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("saveRole")}
        </Button>
        {confirming ? (
          <>
            <Button
              type="submit"
              name="intent"
              value="remove"
              variant="danger"
              disabled={pending}
            >
              {t("confirmRemove")}
            </Button>
            <Button onClick={() => setConfirming(false)} variant="quiet">
              {t("cancel")}
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {t("remove")}
          </Button>
        )}
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function RevokeInvitationForm({
  tenantId,
  id,
}: {
  tenantId: string;
  id: string;
}) {
  const t = useTranslations("members");
  const [state, action, pending] = useActionState(
    revokeInvitation.bind(null, tenantId, id),
    {},
  );
  return (
    <form action={action}>
      <Button type="submit" variant="quiet" disabled={pending}>
        {t("revoke")}
      </Button>
      <Feedback state={state} />
    </form>
  );
}
