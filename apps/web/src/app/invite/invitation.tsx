"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button, buttonClasses } from "../../components/ui/button";
import { Notice } from "../../components/ui/notice";
import { invitationToken } from "../../lib/tenants/invitations";
import { acceptInvitation } from "./actions";

const STORAGE_KEY = "uw-invitation";

function saveInvitationFragment() {
  if (!window.location.hash) return;
  const token = invitationToken.safeParse(window.location.hash.slice(1));
  if (token.success) sessionStorage.setItem(STORAGE_KEY, token.data);
  else sessionStorage.removeItem(STORAGE_KEY);
  window.history.replaceState(null, "", "/invite");
}

function hasStoredInvitation() {
  try {
    return invitationToken.safeParse(sessionStorage.getItem(STORAGE_KEY))
      .success;
  } catch {
    return false;
  }
}

/**
 * Accepting an invitation. The database answers every failure the same way,
 * so that a link reveals nothing about other accounts; the message therefore
 * lists the possible reasons and what the invitee can do about each.
 */
export function Invitation({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("invite");
  const router = useRouter();
  const login = "/login?next=invite";
  // Unknown until the fragment has been read in the browser.
  const [hasLink, setHasLink] = useState<boolean | null>(null);
  useEffect(() => {
    saveInvitationFragment();
    setHasLink(hasStoredInvitation());
    if (!signedIn) router.replace(login);
  }, [signedIn, router]);

  const [state, action, pending] = useActionState(
    async () => {
      saveInvitationFragment();
      const result = await acceptInvitation(
        sessionStorage.getItem(STORAGE_KEY),
      );
      if (!result.error) {
        sessionStorage.removeItem(STORAGE_KEY);
        router.replace("/app/members");
      }
      return result;
    },
    {} as { error?: string },
  );

  if (!signedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft" role="status">
          {t("redirecting")}
        </p>
        <Link href={login} className={buttonClasses()}>
          {t("signIn")}
        </Link>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="space-y-4">
        <Notice tone="error" title={t("unavailableTitle")}>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>{t("reasons.email")}</li>
            <li>{t("reasons.expired")}</li>
            <li>{t("reasons.used")}</li>
          </ul>
        </Notice>
        <p className="text-sm text-ink-soft">{t("unavailableHelp")}</p>
        <Link href="/app" className={buttonClasses({ variant: "secondary" })}>
          {t("toDocuments")}
        </Link>
      </div>
    );
  }

  if (hasLink === false) {
    return (
      <div className="space-y-4">
        <Notice tone="hint" title={t("missingTitle")}>
          {t("missingBody")}
        </Notice>
        <Link href="/app" className={buttonClasses({ variant: "secondary" })}>
          {t("toDocuments")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action}>
      <Button
        type="submit"
        disabled={pending || hasLink === null}
        className="w-full sm:w-auto"
      >
        {pending ? t("accepting") : t("accept")}
      </Button>
    </form>
  );
}
