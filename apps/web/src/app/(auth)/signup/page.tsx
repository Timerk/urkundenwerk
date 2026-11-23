import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account · Urkundenwerk" };

export default function SignupPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <p className="text-sm text-neutral-700">
        You become the admin of a new firm workspace. Use fictional data only.
      </p>
      <SignupForm />
      <p className="text-sm">
        Already registered?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
