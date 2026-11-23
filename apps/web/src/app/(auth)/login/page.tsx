import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Urkundenwerk" };

export default function LoginPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <LoginForm />
      <p className="text-sm text-ink-soft">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-ink underline underline-offset-2"
        >
          Create an account for your firm
        </Link>
      </p>
    </section>
  );
}
