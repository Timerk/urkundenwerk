# ADR-0006 · Consistency rules in a rule engine, structure in the schema

## Context

The Musterprotokoll needs checks beyond types and formats: the minimum
capital of a GmbH, the UG's capital ceiling and full payment, the payment due
before registration, who may be Geschäftsführer, plausible dates, and
heuristics such as a business purpose that is too general. Each check must
cite its legal basis, carry a severity, and keep a stable code. Explanations
(ADR-0007) and clients key on those codes.

Until M3, six cross-field checks lived in a `superRefine` of the Zod schema.
That had three problems. Zod runs refinements only after the structure is
valid, so the builder merged fictional probe values under the draft to see a
rule early. Zod issues have no severity, so warnings were impossible. And a
refinement has nowhere to keep a legal reference or a summary.

## Decision

Keep structural validation in `musterprotokollSchema`: required fields,
types, formats, and ranges. Move every cross-field and legal check into a
typed rule registry in `packages/core/src/rules`, with one rule per check:

```ts
interface Rule<Input, Code> {
  id: Code; // stable code
  templateId: string;
  severity: "error" | "warning" | "info";
  legalReference: string; // e.g. "§ 5 Abs. 1 GmbHG"
  summary: string; // one deterministic English sentence
  paths: readonly string[]; // fields it reads and reports
  check(input: Input, context: { referenceDate: string }): Finding[];
}
```

The engine adds the code and severity to each finding and returns issues
sorted by severity. Rules read a normalised, possibly incomplete draft and
report only what their inputs already show, so the builder needs no probe
values. Two rules, `field_required` and `field_invalid`, turn the schema's
issues into rule issues, so a single call reports everything. Rules never
read the clock. The caller passes today's date, which the web server
computes once per request in German time and hands to the browser, so the
server and the browser check a draft against the same day.

`validateMusterprotokoll` and `buildMusterprotokoll` run the rules and refuse
input with any `error`. Warnings and notes never block an export. The six
codes from M2 are unchanged. Params on an issue are typed to numbers and
booleans only, so no text from a draft can travel in them.

Rules cite the statute they apply. Heuristics, such as the list of generic
business purposes or the notarisation date window, are `warning`s, and their
summaries say what registry courts usually do rather than what the law
requires.

## Consequences

There is one source of truth for each check. The builder's inline hints, the
new Checks panel, the dashboard's readiness, and the export route all run
the same rules. Adding a rule means adding one object and one row in its
case table. The registry test fails if a rule has no cases.

The schema alone no longer guarantees legal consistency. Code that parses
input with `musterprotokollSchema` directly must also call the rules, which
is why `parseDraftAsInput` was replaced by `validateMusterprotokoll` and the
template registry exposes `check` and `validate`. Export errors now carry
rule codes such as `field_required` instead of Zod issue codes.

Date rules depend on the reference date, so the same draft can gain a
warning, for example a notarisation date that has slipped into the past, as
time passes. That is intended. Tests pin the reference date.
