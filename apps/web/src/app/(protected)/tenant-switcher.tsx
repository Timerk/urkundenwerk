"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Select } from "../../components/ui/field";
import { selectTenant } from "./actions";

export function TenantSwitcher({
  tenants,
  currentTenantId,
}: {
  tenants: { tenantId: string; name: string; role: string }[];
  currentTenantId: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const t = useTranslations("common");

  return (
    <form
      ref={form}
      action={selectTenant}
      className="flex min-w-0 items-center gap-2"
    >
      <label htmlFor="tenant-switcher" className="sr-only">
        {t("firm")}
      </label>
      <Select
        ids={{
          controlId: "tenant-switcher",
          describedBy: undefined,
          invalid: false,
        }}
        name="tenantId"
        defaultValue={currentTenantId}
        onChange={() => form.current?.requestSubmit()}
        className="h-9 w-auto max-w-full text-sm font-medium sm:max-w-80"
      >
        {tenants.map((tenant) => (
          <option key={tenant.tenantId} value={tenant.tenantId}>
            {tenant.name} ({tenant.role})
          </option>
        ))}
      </Select>
      <noscript>
        <button type="submit" className="text-sm underline">
          {t("switchFirm")}
        </button>
      </noscript>
    </form>
  );
}
