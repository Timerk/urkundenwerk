"use client";

import type { MusterprotokollDraft } from "@urkundenwerk/core";
import type { ReactNode } from "react";
import type {
  FieldIssue,
  LegalForm,
} from "../../../../../lib/builder/form-model";
import {
  CapitalField,
  ChoiceField,
  DateField,
  TextField,
} from "./draft-fields";

export type FormSectionId =
  "notarisation" | "founder" | "company" | "capital" | "director" | "notes";

/** Which draft paths each section of the form edits. */
export const SECTION_PATHS: Record<FormSectionId, (path: string) => boolean> = {
  notarisation: (path) => path.startsWith("notarisation."),
  founder: (path) => path.startsWith("founder."),
  company: (path) => path.startsWith("company."),
  capital: (path) => path === "shareCapitalCents" || path === "contribution",
  director: (path) => path.startsWith("managingDirector."),
  notes: (path) => path === "notaryNotes",
};

function SectionStatus({ outstanding }: { outstanding: number }) {
  return outstanding === 0 ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ok">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
        <path
          d="m3.5 8.5 3 3 6-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Complete
    </span>
  ) : (
    <span className="text-xs font-medium text-ink-faint">
      {outstanding} to complete
    </span>
  );
}

function FormSection({
  id,
  title,
  description,
  outstanding,
  children,
}: {
  id: FormSectionId;
  title: string;
  description?: ReactNode;
  outstanding: number;
  children: ReactNode;
}) {
  const headingId = `section-${id}`;
  return (
    <section
      aria-labelledby={headingId}
      className="scroll-mt-40 border-t border-rule py-8 first:border-t-0 first:pt-2"
    >
      <div className="mb-5 space-y-1">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id={headingId}
            className="text-lg font-semibold tracking-tight text-ink"
          >
            {title}
          </h2>
          <SectionStatus outstanding={outstanding} />
        </div>
        {description ? (
          <p className="max-w-prose text-sm text-ink-soft">{description}</p>
        ) : null}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">{children}</div>;
}

const salutationOptions = [
  { value: "Herr", label: "Herr" },
  { value: "Frau", label: "Frau" },
  { value: "none", label: "No salutation" },
] as const;

const salutationProps = {
  options: salutationOptions,
  toValue: (value: string) => (value === "none" ? null : value),
  fromValue: (value: unknown) =>
    value === null ? ("none" as const) : (value as "Herr" | "Frau" | undefined),
  description: "Used in the deed's wording, for example “Herrn” in clause 3.",
};

function capitalDescription(form: LegalForm | undefined): string {
  const base = "Whole euros. The deed also writes the amount out in words.";
  if (form === "GmbH") {
    return `${base} A GmbH needs at least 25.000 €, of which half may be paid at formation.`;
  }
  if (form === "UG") {
    return `${base} A UG (haftungsbeschränkt) has 1 € to 24.999 €, paid in full.`;
  }
  return base;
}

export function BuilderForm({
  draft,
  issues,
  legalForm,
}: {
  draft: MusterprotokollDraft;
  issues: Map<string, FieldIssue>;
  legalForm: LegalForm | undefined;
}) {
  const outstanding = (section: FormSectionId) =>
    [...issues.keys()].filter(SECTION_PATHS[section]).length;
  const founderIsEntity = draft.founder?.kind === "legal_entity";
  const founderName = [draft.founder?.firstName, draft.founder?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <FormSection
        id="notarisation"
        title="Notarisation"
        description="Details you leave empty print as dotted lines, to be completed by hand at the appointment."
        outstanding={outstanding("notarisation")}
      >
        <ChoiceField
          path="notarisation.mode"
          options={[
            { value: "in_person", label: "In person" },
            { value: "video", label: "By video (§ 16a BeurkG)" },
          ]}
          description={
            draft.notarisation?.mode === "video"
              ? "The deed adds “mittels Videokommunikation” and ends after clause 7; signing happens electronically."
              : undefined
          }
        />
        <Row>
          <TextField
            path="notarisation.deedNumber"
            optional
            placeholder="123/2026"
          />
          <DateField path="notarisation.date" optional />
        </Row>
        <Row>
          <TextField path="notarisation.notaryName" optional />
          <TextField path="notarisation.notarySeat" optional />
        </Row>
      </FormSection>

      <FormSection
        id="founder"
        title="Founder (Gesellschafter)"
        description="The Musterprotokoll allows exactly one founder."
        outstanding={outstanding("founder")}
      >
        <ChoiceField
          path="founder.kind"
          options={[
            { value: "natural_person", label: "Natural person" },
            { value: "legal_entity", label: "Legal entity" },
          ]}
        />
        {founderIsEntity ? (
          <>
            <TextField path="founder.name" autoComplete="organization" />
            <Row>
              <TextField
                path="founder.registerCourt"
                placeholder="Amtsgericht Musterstadt"
              />
              <TextField
                path="founder.registerNumber"
                placeholder="HRB 12345"
              />
            </Row>
            <TextField path="founder.seat" />
            <TextField
              path="founder.identificationDetails"
              optional
              multiline
              description="Added after the register details, for example “vertreten durch …”."
            />
          </>
        ) : (
          <>
            <ChoiceField path="founder.salutation" {...salutationProps} />
            <Row>
              <TextField path="founder.firstName" />
              <TextField path="founder.lastName" />
            </Row>
            <DateField path="founder.birthDate" className="sm:max-w-[50%]" />
            <TextField path="founder.address.street" />
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
              <TextField path="founder.address.postalCode" />
              <TextField path="founder.address.city" />
            </div>
            <TextField
              path="founder.identificationDetails"
              optional
              multiline
              description="Added after the address, for example how the founder was identified."
            />
          </>
        )}
      </FormSection>

      <FormSection
        id="company"
        title="Company"
        outstanding={outstanding("company")}
      >
        <TextField
          path="company.name"
          placeholder="Musterlicht Software GmbH"
          description={
            legalForm
              ? `Legal form: ${legalForm === "UG" ? "UG (haftungsbeschränkt)" : "GmbH"}.`
              : "End with “GmbH” or “UG (haftungsbeschränkt)”."
          }
        />
        <TextField path="company.seat" placeholder="Musterstadt" />
        <TextField
          path="company.purpose"
          multiline
          description="Completes the sentence “Gegenstand des Unternehmens ist …”."
          placeholder="die Entwicklung und der Vertrieb von Software"
        />
      </FormSection>

      <FormSection
        id="capital"
        title="Capital"
        outstanding={outstanding("capital")}
      >
        <CapitalField description={capitalDescription(legalForm)} />
        <ChoiceField
          path="contribution"
          layout="stack"
          options={[
            {
              value: "full",
              label: "In full, immediately",
              description: "„sofort in voller Höhe“",
            },
            {
              value: "half",
              label: "50 % now, the rest when called in",
              description:
                legalForm === "UG"
                  ? "Not available for a UG (haftungsbeschränkt)."
                  : "„zu 50 Prozent sofort, im Übrigen sobald die Gesellschafterversammlung ihre Einforderung beschließt“",
            },
          ]}
        />
      </FormSection>

      <FormSection
        id="director"
        title="Geschäftsführer (managing director)"
        description="Exempt from the restrictions of § 181 BGB, as the Musterprotokoll prescribes."
        outstanding={outstanding("director")}
      >
        <ChoiceField
          path="managingDirector.kind"
          legend="Who is appointed?"
          layout="stack"
          options={[
            {
              value: "founder",
              label: "The founder",
              description: founderIsEntity
                ? "Only possible when the founder is a natural person."
                : founderName
                  ? `${founderName} is appointed.`
                  : "Uses the founder's name, date of birth, and town.",
            },
            { value: "other", label: "Another person" },
          ]}
        />
        {draft.managingDirector?.kind === "other" ? (
          <>
            <ChoiceField
              path="managingDirector.salutation"
              {...salutationProps}
            />
            <Row>
              <TextField path="managingDirector.firstName" />
              <TextField path="managingDirector.lastName" />
            </Row>
            <Row>
              <DateField path="managingDirector.birthDate" />
              <TextField path="managingDirector.residence" />
            </Row>
          </>
        ) : null}
      </FormSection>

      <FormSection
        id="notes"
        title="Notary's notes"
        outstanding={outstanding("notes")}
      >
        <TextField
          path="notaryNotes"
          optional
          multiline
          description="Completes clause 7: “insbesondere auf Folgendes hingewiesen: …”. Leave empty to add the notes by hand."
        />
      </FormSection>
    </div>
  );
}
