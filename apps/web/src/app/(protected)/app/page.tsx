import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormError } from "../../../components/form-error";
import { createClient, getVerifiedUser } from "../../../lib/supabase/server";
import { CreateFirmForm } from "./create-firm-form";

export const metadata: Metadata = { title: "Your firms · Urkundenwerk" };

const ROLE_LABELS = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
} as const;

export default async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string | string[] }>;
}) {
  const user = await getVerifiedUser();
  if (!user) {
    redirect("/login");
  }

  // RLS limits rows to the caller's tenants; the filter keeps the caller's own
  // memberships rather than those of colleagues.
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("tenant_memberships")
    .select("role, tenant:tenants (id, name)")
    .eq("user_id", user.id)
    .order("created_at");

  if (error) {
    throw new Error("Loading your firms failed.");
  }

  const { setup } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold">Your firms</h1>
      {memberships.length > 0 ? (
        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300">
          {memberships.map(({ role, tenant }) => (
            <li
              key={tenant.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="font-medium">{tenant.name}</span>
              <span className="text-sm text-neutral-700">
                {ROLE_LABELS[role]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <section className="space-y-4">
          {setup === "failed" ? (
            <FormError message="Your account was created, but setting up your firm failed. Please try again." />
          ) : null}
          <p>You are not a member of a firm yet. Create one to get started.</p>
          <CreateFirmForm />
        </section>
      )}
    </>
  );
}
