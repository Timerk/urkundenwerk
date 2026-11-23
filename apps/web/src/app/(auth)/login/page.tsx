import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Urkundenwerk" };

export default function LoginPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <LoginForm />
      <p className="text-sm">
        New here?{" "}
        <Link href="/signup" className="underline">
          Create an account for your firm
        </Link>
      </p>
    </section>
  );
}
