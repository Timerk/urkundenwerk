"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { FormError } from "../../components/form-error";
import { Button, buttonClasses } from "../../components/ui/button";
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

export function Invitation({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("invite");
  const router = useRouter();
  const login = "/login?next=invite";
  useEffect(() => {
    saveInvitationFragment();
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

  return signedIn ? (
    <form action={action} className="space-y-3">
      <FormError message={state.error} />
      <Button type="submit" disabled={pending}>
        {t("accept")}
      </Button>
    </form>
  ) : (
    <Link href={login} className={buttonClasses()}>
      {t("signIn")}
    </Link>
  );
}
