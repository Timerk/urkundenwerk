"use client";

import { useTranslations } from "next-intl";
import type { FieldIssue } from "../../../../../lib/builder/form-model";
import { FormSection } from "./builder-form";
import { CheckboxField, EuroField, TextField } from "./draft-fields";

export function FilingForm({
  issues,
}: {
  issues: ReadonlyMap<string, FieldIssue>;
}) {
  const messages = useTranslations("filing");
  const outstanding = (...paths: string[]) =>
    [...issues.values()].filter(
      (issue) =>
        issue.severity === "error" &&
        paths.some((path) => issue.path.startsWith(path)),
    ).length;
  return (
    <div className="space-y-0">
      <FormSection
        id="filing-court"
        title={messages("courtTitle")}
        outstanding={outstanding("filing.registerCourt")}
      >
        <TextField
          path="filing.registerCourt"
          description={messages("courtDescription")}
        />
      </FormSection>
      <FormSection
        id="filing-address"
        title={messages("addressTitle")}
        outstanding={outstanding("filing.businessAddress.")}
      >
        <TextField path="filing.businessAddress.street" />
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
          <TextField path="filing.businessAddress.postalCode" />
          <TextField path="filing.businessAddress.city" />
        </div>
      </FormSection>
      <FormSection
        id="filing-payment"
        title={messages("paymentTitle")}
        description={messages("paymentDescription")}
        outstanding={outstanding(
          "filing.paidCents",
          "filing.fundsAtFreeDisposal",
          "filing.noDisqualification",
          "filing.instructedOnDisclosure",
        )}
      >
        <EuroField
          path="filing.paidCents"
          description={messages("amountDescription")}
        />
        <CheckboxField
          path="filing.fundsAtFreeDisposal"
          description={messages("fundsDescription")}
        />
        <CheckboxField
          path="filing.noDisqualification"
          description={messages("disqualificationDescription")}
        />
        <CheckboxField
          path="filing.instructedOnDisclosure"
          description={messages("disclosureDescription")}
        />
      </FormSection>
      <section
        aria-labelledby="filing-attachments"
        className="space-y-4 border-t border-rule py-8"
      >
        <div className="space-y-1">
          <h2
            id="filing-attachments"
            className="text-lg font-semibold tracking-tight text-ink"
          >
            {messages("attachmentsTitle")}
          </h2>
          <p className="text-sm text-ink-soft">
            {messages("attachmentsDescription")}
          </p>
        </div>
        <CheckboxField
          path="filing.paymentEvidenceAttached"
          description={messages("evidenceDescription")}
        />
      </section>
    </div>
  );
}
