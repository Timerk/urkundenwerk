"use client";

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

  return (
    <form ref={form} action={selectTenant} className="flex items-center gap-2">
      <label htmlFor="tenant-switcher" className="sr-only">
        Firm
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
        className="h-9 w-auto max-w-44 text-sm font-medium sm:max-w-64"
      >
        {tenants.map((tenant) => (
          <option key={tenant.tenantId} value={tenant.tenantId}>
            {tenant.name} ({tenant.role})
          </option>
        ))}
      </Select>
      <noscript>
        <button type="submit" className="text-sm underline">
          Switch
        </button>
      </noscript>
    </form>
  );
}
