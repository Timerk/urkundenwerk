import Link from "next/link";
import { buttonClasses } from "../../../../../components/ui/button";

export default function DocumentNotFound() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-16 sm:px-6">
      <h1 className="font-serif text-3xl">Document not found</h1>
      <p className="text-ink-soft">
        This document does not exist, or it belongs to a firm you are not a
        member of.
      </p>
      <Link href="/app" className={buttonClasses({ variant: "secondary" })}>
        Back to your documents
      </Link>
    </div>
  );
}
