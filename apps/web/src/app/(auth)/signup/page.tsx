import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account · Urkundenwerk" };

export default function SignupPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-sm text-ink-soft">
          You become the admin of a new firm workspace. Use fictional data only.
        </p>
      </div>
      <SignupForm />
      <p className="text-sm text-ink-soft">
        Already registered?{" "}
        <Link
          href="/login"
          className="font-medium text-ink underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </section>
  );
}
