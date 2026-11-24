"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { FormError } from "../../../../components/form-error";
import { Button } from "../../../../components/ui/button";
import {
  CheckIcon,
  ConfirmPanel,
  StatusMessage,
} from "../../../../components/ui/confirm";
import { Field, Select, TextInput } from "../../../../components/ui/field";
import { SegmentedControl } from "../../../../components/ui/segmented";
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

/*
 * A removed member or a revoked invitation disappears from the list when the
 * page revalidates, and with it any message next to it. Results that remove
 * their row are therefore announced in one region above the lists, and focus
 * moves there so keyboard users are not left on a vanished control.
 */
const AnnounceContext = createContext<(message: string) => void>(() => {});

export function MembersAnnouncer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const region = useRef<HTMLDivElement>(null);
  function announce(text: string) {
    setMessage(text);
    requestAnimationFrame(() => region.current?.focus());
  }
  return (
    <AnnounceContext.Provider value={announce}>
      <div ref={region} tabIndex={-1} className="outline-none">
        <StatusMessage
          tone="success"
          message={message}
          className="rounded-sm border border-ok/30 bg-paper px-4 py-2.5"
        />
      </div>
      {children}
    </AnnounceContext.Provider>
  );
}

function Feedback({ state }: { state: FormResult }) {
  const t = useTranslations("members");
  if (state.error) return <FormError message={t(state.error)} />;
  return (
    <StatusMessage
      tone="success"
      message={state.success ? t(state.success) : undefined}
    />
  );
}

export function MemberRow({
  tenantId,
  firmName,
  userId,
  role,
  isSelf,
  name,
  email,
}: {
  tenantId: string;
  firmName: string;
  userId: string;
  role: TenantRole;
  isSelf: boolean;
  name: string;
  email: string | null;
}) {
  const t = useTranslations("members");
  const roles = useTranslations("roles");
  const announce = useContext(AnnounceContext);
  const [state, action, pending] = useActionState(
    async (previous: FormResult, form: FormData) => {
      const result = await changeMembership(tenantId, userId, previous, form);
      if (result.success === "removed") announce(t("removedNamed", { name }));
      return result;
    },
    {},
  );
  // A saved role becomes the new baseline once the page revalidates.
  const [selection, setSelection] = useState({ base: role, value: role });
  const selected = selection.base === role ? selection.value : role;
  const setSelected = (value: TenantRole) =>
    setSelection({ base: role, value });
  const [confirming, setConfirming] = useState(false);
  const removeButton = useRef<HTMLButtonElement>(null);
  const dirty = selected !== role;
  const selectId = `role-${userId}`;

  function cancel() {
    setConfirming(false);
    requestAnimationFrame(() => removeButton.current?.focus());
  }

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <form action={action} className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <PersonLabel name={name} email={email} isSelf={isSelf} />
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={selectId} className="sr-only">
              {t("roleOf", { name })}
            </label>
            <div className="w-40 sm:w-44">
              <Select
                ids={{
                  controlId: selectId,
                  describedBy: undefined,
                  invalid: false,
                }}
                name="role"
                value={selected}
                onChange={(event) =>
                  setSelected(memberRole.parse(event.target.value))
                }
                disabled={pending || confirming}
                className="h-9 text-sm"
              >
                {memberRole.options.map((value) => (
                  <option key={value} value={value}>
                    {roles(value)}
                  </option>
                ))}
              </Select>
            </div>
            {dirty ? (
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="h-9"
                  disabled={pending}
                >
                  {pending ? t("saving") : t("saveRole")}
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  className="h-9"
                  onClick={() => setSelected(role)}
                  disabled={pending}
                >
                  {t("cancel")}
                </Button>
              </div>
            ) : (
              <Button
                ref={removeButton}
                variant="danger"
                size="sm"
                className="h-9"
                aria-expanded={confirming}
                aria-label={isSelf ? undefined : `${t("remove")}: ${name}`}
                onClick={() => setConfirming(true)}
              >
                {isSelf ? t("leave") : t("remove")}
              </Button>
            )}
          </div>
        </div>
        {confirming ? (
          <ConfirmPanel
            title={
              isSelf
                ? t("confirmLeaveTitle", { firm: firmName })
                : t("confirmRemoveTitle", { name, firm: firmName })
            }
            confirmLabel={isSelf ? t("leave") : t("remove")}
            pendingLabel={t("removing")}
            cancelLabel={t("cancel")}
            pending={pending}
            onCancel={cancel}
            confirmProps={{ name: "intent", value: "remove" }}
          >
            {isSelf ? t("confirmLeaveBody") : t("confirmRemoveBody")}
          </ConfirmPanel>
        ) : null}
        <Feedback state={state} />
      </form>
    </li>
  );
}

export function PersonLabel({
  name,
  email,
  isSelf,
}: {
  name: string;
  email: string | null;
  isSelf: boolean;
}) {
  const t = useTranslations("members");
  return (
    <div className="min-w-0 flex-1 basis-56 text-sm [overflow-wrap:anywhere]">
      <p className="flex flex-wrap items-center gap-x-2 font-medium text-ink">
        {name}
        {isSelf ? (
          <span className="rounded-xs border border-rule-strong px-1.5 py-px text-xs font-normal text-ink-soft">
            {t("you")}
          </span>
        ) : null}
      </p>
      {email && email !== name ? (
        <p className="text-ink-soft">{email}</p>
      ) : null}
    </div>
  );
}

type InvitationState = FormResult & { email?: string };

export function InvitationForm({ tenantId }: { tenantId: string }) {
  const t = useTranslations("members");
  const roles = useTranslations("roles");
  const [role, setRole] = useState<TenantRole>("viewer");
  const [state, action, pending] = useActionState(
    async (previous: InvitationState, form: FormData) => {
      const result = await createInvitation(tenantId, previous, form);
      return { ...result, email: String(form.get("email") ?? "") };
    },
    {} as InvitationState,
  );
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <Field label={t("email")}>
          {(ids) => (
            <TextInput
              ids={ids}
              name="email"
              type="email"
              maxLength={254}
              required
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>
        <SegmentedControl
          legend={t("role")}
          name="role"
          value={role}
          onChange={setRole}
          layout="stack"
          options={memberRole.options.map((value) => ({
            value,
            label: roles(value),
            description: t(`roleHelp.${value}`),
          }))}
        />
        <FormError message={state.error ? t(state.error) : undefined} />
        <Button type="submit" disabled={pending}>
          {pending ? t("creating") : t("create")}
        </Button>
      </form>
      {state.token ? (
        <InvitationLink
          key={state.token}
          token={state.token}
          email={state.email ?? ""}
        />
      ) : null}
    </div>
  );
}

function InvitationLink({ token, email }: { token: string; email: string }) {
  const t = useTranslations("members");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const heading = useRef<HTMLParagraphElement>(null);
  const link = new URL(`/invite#${token}`, window.location.origin).href;
  useEffect(() => {
    heading.current?.focus();
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setMessage(t("copied"));
    } catch {
      setMessage(t("copyManually"));
    }
  }
  return (
    <div className="space-y-3 rounded-sm border border-stamp/25 bg-stamp-wash p-4">
      <div>
        <p
          ref={heading}
          tabIndex={-1}
          className="font-medium text-ink outline-none [overflow-wrap:anywhere]"
        >
          {t("createdTitle", { email })}
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">{t("createdBody")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("link")} className="min-w-0 flex-1 basis-60">
          {(ids) => (
            <TextInput
              ids={ids}
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className="text-sm"
            />
          )}
        </Field>
        <Button variant="secondary" onClick={copy}>
          {copied ? <CheckIcon className="size-3.5" /> : null}
          {copied ? t("copiedShort") : t("copy")}
        </Button>
      </div>
      <StatusMessage message={message} className="text-ink-soft" />
    </div>
  );
}

export function RevokeInvitationForm({
  tenantId,
  id,
  email,
}: {
  tenantId: string;
  id: string;
  email: string;
}) {
  const t = useTranslations("members");
  const announce = useContext(AnnounceContext);
  const [state, action, pending] = useActionState(async () => {
    const result = await revokeInvitation(tenantId, id);
    if (result.success) announce(t("revokedNamed", { email }));
    return result;
  }, {} as FormResult);
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <form action={action} className="contents">
      {confirming ? (
        <ConfirmPanel
          className="basis-full"
          title={t("confirmRevokeTitle", { email })}
          confirmLabel={t("revoke")}
          pendingLabel={t("revoking")}
          cancelLabel={t("cancel")}
          pending={pending}
          onCancel={() => {
            setConfirming(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }}
        >
          {t("confirmRevokeBody")}
        </ConfirmPanel>
      ) : (
        <Button
          ref={trigger}
          variant="quiet"
          size="sm"
          aria-label={`${t("revoke")}: ${email}`}
          onClick={() => setConfirming(true)}
        >
          {t("revoke")}
        </Button>
      )}
      {state.error ? (
        <div className="basis-full">
          <Feedback state={state} />
        </div>
      ) : null}
    </form>
  );
}
