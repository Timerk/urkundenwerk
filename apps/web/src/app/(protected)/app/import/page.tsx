import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonClasses } from "../../../../components/ui/button";
import { Notice } from "../../../../components/ui/notice";
import { aiState } from "../../../../lib/ai/state";
import { getCurrentMembership } from "../../../../lib/tenants/memberships";
import { canEditDocuments } from "../../../../lib/tenants/selection";
import { ImportFlow } from "./import-flow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: `${t("import")} · Urkundenwerk` };
}

async function Unavailable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl text-ink">{t("import.title")}</h1>
      <Notice title={title}>{children}</Notice>
      <Link href="/app" className={buttonClasses({ variant: "secondary" })}>
        {t("common.backToDocuments")}
      </Link>
    </div>
  );
}

export default async function ImportPage() {
  const t = await getTranslations();
  const membership = await getCurrentMembership();
  if (!membership || !canEditDocuments(membership.role)) {
    return (
      <Unavailable title={t("import.unavailable.roleTitle")}>
        {membership
          ? t("import.unavailable.roleBody", {
              firm: membership.name,
              role: t(`roles.${membership.role}`),
            })
          : t("import.unavailable.noFirm")}
      </Unavailable>
    );
  }

  const state = aiState();
  if (!state.ok || !state.extractClient) {
    return (
      <Unavailable title={t("import.unavailable.aiTitle")}>
        {t.rich("import.unavailable.aiBody", {
          code: (chunks) => <code>{chunks}</code>,
        })}
      </Unavailable>
    );
  }

  return (
    <ImportFlow
      tenantId={membership.tenantId}
      firmName={membership.name}
      provider={state.extractClient.provider}
      model={state.config.models.extract}
    />
  );
}
