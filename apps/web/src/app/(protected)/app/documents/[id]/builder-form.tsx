"use client";

import type { MusterprotokollDraft } from "@urkundenwerk/core";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type {
  FieldIssue,
  LegalForm,
} from "../../../../../lib/builder/form-model";
import { ChoiceField, DateField, EuroField, TextField } from "./draft-fields";

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
  const t = useTranslations("builder.section");
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
      {t("complete")}
    </span>
  ) : (
    <span className="text-xs font-medium whitespace-nowrap text-ink-faint">
      {t("outstanding", { count: outstanding })}
    </span>
  );
}

export function FormSection({
  id,
  title,
  description,
  outstanding,
  children,
}: {
  id: string;
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

const SALUTATIONS = ["Herr", "Frau", "none"] as const;

function useSalutationProps() {
  const t = useTranslations("options.salutation");
  const hints = useTranslations("builder.hints");
  return {
    options: SALUTATIONS.map((value) => ({ value, label: t(value) })),
    toValue: (value: string) => (value === "none" ? null : value),
    fromValue: (value: unknown) =>
      value === null
        ? ("none" as const)
        : (value as "Herr" | "Frau" | undefined),
    description: hints("salutation"),
  };
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
  const t = useTranslations("builder");
  const options = useTranslations("options");
  const salutationProps = useSalutationProps();
  const capitalDescription = [
    t("hints.capital"),
    legalForm === "GmbH"
      ? t("hints.capitalGmbh")
      : legalForm === "UG"
        ? t("hints.capitalUg")
        : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <FormSection
        id="notarisation"
        title={t("sections.notarisation.title")}
        description={t("sections.notarisation.description")}
        outstanding={outstanding("notarisation")}
      >
        <ChoiceField
          path="notarisation.mode"
          options={[
            { value: "in_person", label: options("mode.in_person") },
            { value: "video", label: options("mode.video") },
          ]}
          description={
            draft.notarisation?.mode === "video" ? t("hints.video") : undefined
          }
        />
        <Row>
          <TextField
            path="notarisation.deedNumber"
            optional
            placeholder={t("placeholders.deedNumber")}
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
        title={t("sections.founder.title")}
        description={t("sections.founder.description")}
        outstanding={outstanding("founder")}
      >
        <ChoiceField
          path="founder.kind"
          options={[
            {
              value: "natural_person",
              label: options("founderKind.natural_person"),
            },
            {
              value: "legal_entity",
              label: options("founderKind.legal_entity"),
            },
          ]}
        />
        {founderIsEntity ? (
          <>
            <TextField path="founder.name" autoComplete="organization" />
            <Row>
              <TextField
                path="founder.registerCourt"
                placeholder={t("placeholders.registerCourt")}
              />
              <TextField
                path="founder.registerNumber"
                placeholder={t("placeholders.registerNumber")}
              />
            </Row>
            <TextField path="founder.seat" />
            <TextField
              path="founder.identificationDetails"
              optional
              multiline
              description={t("hints.entityDetails")}
            />
          </>
        ) : (
          <>
            <ChoiceField path="founder.salutation" {...salutationProps} />
            <Row>
              <TextField path="founder.firstName" />
              <TextField path="founder.lastName" />
            </Row>
            <DateField path="founder.birthDate" autoComplete="bday" />
            <TextField path="founder.address.street" />
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
              <TextField path="founder.address.postalCode" />
              <TextField path="founder.address.city" />
            </div>
            <TextField
              path="founder.identificationDetails"
              optional
              multiline
              description={t("hints.personDetails")}
            />
          </>
        )}
      </FormSection>

      <FormSection
        id="company"
        title={t("sections.company.title")}
        outstanding={outstanding("company")}
      >
        <TextField
          path="company.name"
          placeholder={t("placeholders.companyName")}
          description={
            legalForm
              ? t("hints.legalForm", {
                  form: legalForm === "UG" ? "UG (haftungsbeschränkt)" : "GmbH",
                })
              : t("hints.legalFormMissing")
          }
        />
        <TextField path="company.seat" placeholder={t("placeholders.seat")} />
        <TextField
          path="company.purpose"
          multiline
          description={t("hints.purpose")}
          placeholder={t("placeholders.purpose")}
        />
      </FormSection>

      <FormSection
        id="capital"
        title={t("sections.capital.title")}
        outstanding={outstanding("capital")}
      >
        <EuroField path="shareCapitalCents" description={capitalDescription} />
        <ChoiceField
          path="contribution"
          layout="stack"
          options={[
            {
              value: "full",
              label: options("contribution.full"),
              description: "„sofort in voller Höhe“",
            },
            {
              value: "half",
              label: options("contribution.half"),
              description:
                legalForm === "UG"
                  ? t("hints.halfUg")
                  : "„zu 50 Prozent sofort, im Übrigen sobald die Gesellschafterversammlung ihre Einforderung beschließt“",
            },
          ]}
        />
      </FormSection>

      <FormSection
        id="director"
        title={t("sections.director.title")}
        description={t("sections.director.description")}
        outstanding={outstanding("director")}
      >
        <ChoiceField
          path="managingDirector.kind"
          legend={t("hints.directorQuestion")}
          layout="stack"
          options={[
            {
              value: "founder",
              label: options("directorKind.founder"),
              description: founderIsEntity
                ? t("hints.directorEntity")
                : founderName
                  ? t("hints.directorNamed", { name: founderName })
                  : t("hints.directorFounder"),
            },
            { value: "other", label: options("directorKind.other") },
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
        title={t("sections.notes.title")}
        outstanding={outstanding("notes")}
      >
        <TextField
          path="notaryNotes"
          optional
          multiline
          description={t("hints.notes")}
        />
      </FormSection>
    </div>
  );
}
