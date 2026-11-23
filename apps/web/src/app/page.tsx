import {
  buildMusterprotokollPreview,
  musterprotokollMetadata,
  type MusterprotokollDraft,
} from "@urkundenwerk/core";
import Link from "next/link";
import { BrandMark } from "../components/brand";
import { DocumentPreview } from "../components/document-preview";
import { buttonClasses } from "../components/ui/button";

// Fictional case data for the excerpt on this page.
const exampleDraft: MusterprotokollDraft = {
  notarisation: {
    mode: "in_person",
    deedNumber: "117/2026",
    date: "2026-11-20",
    notaryName: "Dr. Nora Musterfrau",
    notarySeat: "Musterstadt",
  },
  founder: {
    kind: "natural_person",
    salutation: "Frau",
    firstName: "Erika",
    lastName: "Mustermann",
    birthDate: "1990-03-07",
    address: {
      street: "Musterweg 12",
      postalCode: "12345",
      city: "Musterstadt",
    },
  },
  company: {
    name: "Nordmuster Logistik GmbH",
    seat: "Musterstadt",
    purpose: "die Planung und Vermittlung von Logistikdienstleistungen",
  },
  shareCapitalCents: 2_500_000,
  contribution: "full",
  managingDirector: { kind: "founder" },
};

const points = [
  {
    title: "Statutory wording, word for word",
    body: `The deed text of ${musterprotokollMetadata.legalBasis} comes from a versioned template. The app collects data and never writes legal text.`,
  },
  {
    title: "Checked while you type",
    body: "Missing details and rules such as the GmbH minimum capital or a UG's full payment show up next to the field.",
  },
  {
    title: "PDF and DOCX for signature",
    body: "Both exports render the same document model, set in A4 with closing and signature lines.",
  },
  {
    title: "Each firm on its own",
    body: "Drafts are isolated per law firm by row-level security in Postgres. Viewers can read, editors can write.",
  },
];

export default function Home() {
  const model = buildMusterprotokollPreview(exampleDraft);

  return (
    <main className="grid min-h-[calc(100dvh-2rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10 lg:py-16 xl:px-16">
        <div className="max-w-xl space-y-8">
          <div className="flex items-center gap-3">
            <BrandMark className="size-10" />
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Urkundenwerk
            </h1>
          </div>
          <p className="text-xl leading-relaxed text-ink">
            Prepare the Musterprotokoll for a single-founder GmbH or UG from
            structured case data, and download it ready for signature.
          </p>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {points.map((point) => (
              <div key={point.title} className="space-y-1">
                <dt className="text-sm font-semibold">{point.title}</dt>
                <dd className="text-sm leading-relaxed text-ink-soft">
                  {point.body}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className={buttonClasses({ className: "h-11 px-5 text-base" })}
            >
              Sign in to the demo
            </Link>
            <Link
              href="/signup"
              className={buttonClasses({
                variant: "quiet",
                className: "h-11 text-base",
              })}
            >
              Create a firm account
            </Link>
          </div>
          <p className="max-w-prose border-t border-rule pt-5 text-sm text-ink-faint">
            Urkundenwerk is a portfolio project, not a product. It gives no
            legal advice and works with fictional people and firms only.
          </p>
        </div>
      </div>

      <div
        aria-label="Excerpt of a generated Musterprotokoll"
        role="figure"
        className="relative overflow-hidden bg-desk px-5 pt-10 max-lg:max-h-[34rem] sm:px-10 lg:pt-16"
      >
        <div className="deed-sheet deed-write mx-auto max-w-[44rem] lg:mr-0 lg:ml-6 xl:ml-12">
          <DocumentPreview
            model={model}
            blockFilter={(block) =>
              block.kind !== "signatures" &&
              (block.kind !== "clause" || block.number <= 4)
            }
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-desk to-transparent"
        />
      </div>
    </main>
  );
}
