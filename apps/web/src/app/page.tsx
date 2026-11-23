import Link from "next/link";
import { Disclaimer } from "../components/disclaimer";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Urkundenwerk</h1>
      <p>An AI-assisted document builder for German law firms.</p>
      <Disclaimer />
      <p>
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
