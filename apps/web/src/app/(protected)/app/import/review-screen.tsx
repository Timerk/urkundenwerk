"use client";

import type {
  ExtractionFieldPath,
  FieldReview,
} from "@urkundenwerk/extraction/contract";
import { fieldKind } from "@urkundenwerk/extraction/contract";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Button } from "../../../../components/ui/button";
import {
  Field,
  Select,
  TextArea,
  TextInput,
} from "../../../../components/ui/field";
import { Notice } from "../../../../components/ui/notice";
import { fieldLabel } from "../../../../lib/builder/fields";
import {
  acceptAllVerified,
  type Decision,
  type Decisions,
  draftFromDecisions,
  editText,
  fieldOptions,
  formatValue,
  initialDecisions,
  parseEdit,
  pendingFields,
  REVIEW_SECTIONS,
  sectionOf,
} from "../../../../lib/import/review-model";
import { createDraftFromImport, type ExtractedContract } from "./actions";
import { SourceSheet } from "./source-sheet";

/** The DOM id of a field's row on the review screen. */
export function reviewRowId(path: string): string {
  return `review-${path.replaceAll(".", "-")}`;
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function StatusBadge({ field }: { field: FieldReview }) {
  if (field.status === "verified") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ok">
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
        Verified in source
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-xs bg-hint-wash px-1.5 py-px text-xs font-medium text-hint">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
        <path d="M8 1.5 15 14H1L8 1.5Z" fill="currentColor" />
        <path
          d="M8 6v3.5M8 11.4v.1"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      Unverified
    </span>
  );
}

const DECISIONS = [
  { kind: "accepted", label: "Accept" },
  { kind: "edited", label: "Edit" },
  { kind: "cleared", label: "Clear" },
] as const;

function DecisionControl({
  field,
  choice,
  onChoose,
}: {
  field: FieldReview;
  choice: "accepted" | "edited" | "cleared" | undefined;
  onChoose: (kind: "accepted" | "edited" | "cleared") => void;
}) {
  const label = fieldLabel(field.path);
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Decision for {label}</legend>
      <div className="inline-flex rounded-sm border border-rule-strong bg-paper p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stamp">
        {DECISIONS.map((option) => {
          const checked = choice === option.kind;
          // A value that could not be read can only be edited or cleared.
          const disabled = option.kind === "accepted" && field.value === null;
          return (
            <label
              key={option.kind}
              className={`relative flex min-h-8 cursor-pointer items-center justify-center rounded-[3px] px-3.5 text-sm transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:text-ink-faint/60 ${
                checked
                  ? "bg-ink font-medium text-white"
                  : "text-ink-soft hover:bg-surface hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name={`decision-${field.path}`}
                value={option.kind}
                checked={checked}
                disabled={disabled}
                onChange={() => onChoose(option.kind)}
                className="absolute inset-0 cursor-[inherit] opacity-0"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function EditControl({
  field,
  initial,
  onValue,
}: {
  field: FieldReview;
  initial: string;
  onValue: (value: string | number | undefined) => void;
}) {
  const [text, setText] = useState(initial);
  const result = useMemo(() => parseEdit(field.path, text), [field.path, text]);
  const kind = fieldKind(field.path);
  const label = `New value for ${fieldLabel(field.path)}`;

  useEffect(() => {
    onValue(result.ok ? result.value : undefined);
  }, [result, onValue]);

  return (
    <Field label={label} error={result.ok ? undefined : result.message}>
      {(ids) =>
        kind.type === "enum" ? (
          <Select
            ids={ids}
            value={text}
            onChange={(event) => setText(event.target.value)}
          >
            <option value="">Choose…</option>
            {fieldOptions(field.path).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : kind.type === "freeText" ? (
          <TextArea
            ids={ids}
            value={text}
            rows={3}
            onChange={(event) => setText(event.target.value)}
          />
        ) : (
          <TextInput
            ids={ids}
            type={kind.type === "date" ? "date" : "text"}
            inputMode={kind.type === "amount" ? "numeric" : undefined}
            value={text}
            autoComplete="off"
            onChange={(event) => setText(event.target.value)}
          />
        )
      }
    </Field>
  );
}

function FieldRow({
  field,
  decision,
  active,
  onDecide,
  onShowSource,
}: {
  field: FieldReview;
  decision: Decision | undefined;
  active: boolean;
  onDecide: (decision: Decision) => void;
  onShowSource: () => void;
}) {
  const [choice, setChoice] = useState<
    "accepted" | "edited" | "cleared" | undefined
  >(decision?.kind === "pending" ? undefined : decision?.kind);
  const headingId = `${reviewRowId(field.path)}-label`;
  const handleEdit = useCallback(
    (value: string | number | undefined) =>
      onDecide(
        value === undefined ? { kind: "pending" } : { kind: "edited", value },
      ),
    [onDecide],
  );

  // "Accept all verified" decides from outside the row.
  useEffect(() => {
    if (decision?.kind === "accepted") setChoice("accepted");
  }, [decision?.kind]);

  const choose = (kind: "accepted" | "edited" | "cleared") => {
    setChoice(kind);
    if (kind === "accepted") onDecide({ kind: "accepted" });
    if (kind === "cleared") onDecide({ kind: "cleared" });
    // An edit counts once its value is valid; until then it is pending.
    if (kind === "edited") onDecide({ kind: "pending" });
  };

  return (
    <li
      id={reviewRowId(field.path)}
      tabIndex={-1}
      aria-labelledby={headingId}
      data-active={active || undefined}
      data-status={field.status}
      className="scroll-mt-40 space-y-2.5 border-t border-rule py-5 outline-none first:border-t-0 data-[active]:shadow-[inset_3px_0_0_var(--color-stamp)] data-[active]:-mx-4 data-[active]:px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={headingId} className="text-sm font-medium text-ink-soft">
          {fieldLabel(field.path)}
        </h3>
        <StatusBadge field={field} />
      </div>

      <p
        className={`text-lg leading-snug ${
          choice === "cleared"
            ? "text-ink-faint line-through decoration-1"
            : "text-ink"
        }`}
      >
        {field.value !== null ? (
          formatValue(field.path, field.value)
        ) : (
          <span className="text-ink-faint">
            “{field.text}” <span className="text-sm">(could not be read)</span>
          </span>
        )}
      </p>

      {field.reasons.length > 0 ? (
        <ul className="space-y-1 rounded-sm border-l-2 border-hint-rule bg-hint-wash px-2.5 py-1.5 text-sm text-hint">
          {field.reasons.map((reason) => (
            <li key={reason.code}>{reason.message}</li>
          ))}
        </ul>
      ) : null}

      {field.quote ? (
        <blockquote className="border-l-2 border-stamp/40 pl-3 font-serif text-[0.95rem] leading-relaxed text-ink-soft">
          {field.quote}
        </blockquote>
      ) : null}

      {field.note ? (
        <p className="text-sm text-ink-faint">
          <span className="font-medium text-ink-soft">Model note:</span>{" "}
          {field.note}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
        <DecisionControl field={field} choice={choice} onChoose={choose} />
        {field.citation ? (
          <button
            type="button"
            onClick={onShowSource}
            aria-label={`Show the passage for ${fieldLabel(field.path)} in the document`}
            className="rounded-sm text-sm font-medium text-stamp underline decoration-stamp/30 underline-offset-4 hover:decoration-stamp"
          >
            Show in document
          </button>
        ) : field.quote ? (
          <span className="text-sm text-ink-faint">
            Quote not found in the document
          </span>
        ) : null}
      </div>
      {choice === "edited" ? (
        <EditControl
          field={field}
          initial={editText(field.path, field.value)}
          onValue={handleEdit}
        />
      ) : null}
    </li>
  );
}

export function ReviewScreen({
  tenantId,
  contract,
  onRestart,
}: {
  tenantId: string;
  contract: ExtractedContract;
  onRestart: () => void;
}) {
  const { fields, source } = contract;
  const [decisions, setDecisions] = useState<Decisions>(() =>
    initialDecisions(fields),
  );
  const [activePath, setActivePath] = useState<ExtractionFieldPath>();
  const [pane, setPane] = useState<"fields" | "source">("fields");
  const [error, setError] = useState<string>();
  const [confirming, startConfirm] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const header = useRef<HTMLElement>(null);
  const paneToggle = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ target: "row" | "mark"; path: string } | null>(
    null,
  );

  const found = fields.filter(({ status }) => status !== "absent");
  const verified = found.filter(({ status }) => status === "verified");
  const pending = pendingFields(fields, decisions);
  const accepted = found.filter(({ path }) => {
    const kind = decisions[path]?.kind;
    return kind === "accepted" || kind === "edited";
  });

  // Move focus to the review once it replaces the upload.
  useEffect(() => heading.current?.focus(), []);

  // As in the builder: whichever bar is sticky sets the offset for the
  // source pane and for scrolling rows into view below it.
  useEffect(() => {
    const root = document.documentElement;
    const wideQuery = window.matchMedia("(min-width: 64rem)");
    const measure = () => {
      const bar = wideQuery.matches ? header.current : paneToggle.current;
      root.style.setProperty("--builder-sticky", `${bar?.offsetHeight ?? 0}px`);
    };
    const observer = new ResizeObserver(measure);
    if (header.current) observer.observe(header.current);
    if (paneToggle.current) observer.observe(paneToggle.current);
    wideQuery.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      wideQuery.removeEventListener("change", measure);
      root.style.removeProperty("--builder-sticky");
    };
  }, []);

  const decide = useCallback(
    (path: ExtractionFieldPath) => (decision: Decision) =>
      setDecisions((current) =>
        current[path]?.kind === decision.kind && decision.kind !== "edited"
          ? current
          : { ...current, [path]: decision },
      ),
    [],
  );
  // One stable callback per field, so rows and edit controls do not re-run.
  const deciders = useMemo(
    () =>
      Object.fromEntries(
        fields.map(({ path }) => [path, decide(path)]),
      ) as Record<ExtractionFieldPath, (decision: Decision) => void>,
    [fields, decide],
  );

  const showMark = useCallback((path: string) => {
    const mark = document.querySelector<HTMLElement>(
      `[data-source-paths~="${path}"]`,
    );
    mark?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
    return mark;
  }, []);

  const showRow = useCallback((path: string) => {
    const row = document.getElementById(reviewRowId(path));
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }, []);

  // After switching panes on narrow screens, act once the pane is visible.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target.target === "row") showRow(target.path);
    else showMark(target.path)?.focus({ preventScroll: true });
  }, [pane, showMark, showRow]);

  const wide = () => window.matchMedia("(min-width: 64rem)").matches;

  const showInSource = (path: ExtractionFieldPath) => {
    setActivePath(path);
    if (wide()) {
      showMark(path);
    } else {
      pendingFocus.current = { target: "mark", path };
      setPane("source");
    }
  };

  const selectFromSource = (path: ExtractionFieldPath) => {
    setActivePath(path);
    if (wide()) {
      showRow(path);
    } else {
      pendingFocus.current = { target: "row", path };
      setPane("fields");
    }
  };

  const confirm = () => {
    setError(undefined);
    const first = pending[0];
    if (first) {
      setError(
        pending.length === 1
          ? `${fieldLabel(first.path)} still needs a decision.`
          : `${pending.length} values still need a decision. Accept, edit, or clear each one.`,
      );
      if (!wide()) {
        pendingFocus.current = { target: "row", path: first.path };
        setPane("fields");
      } else {
        showRow(first.path);
      }
      return;
    }
    startConfirm(async () => {
      const result = await createDraftFromImport(
        tenantId,
        draftFromDecisions(fields, decisions),
      );
      // On success the action navigates to the new draft.
      if (!result.ok) setError(result.error);
    });
  };

  const progressId = "review-progress";
  const citations = found.flatMap((field) =>
    field.citation
      ? [{ path: field.path, citation: field.citation, status: field.status }]
      : [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        ref={header}
        className="z-20 border-b border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85 lg:sticky lg:top-0"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1
              ref={heading}
              tabIndex={-1}
              className="truncate font-serif text-xl text-ink outline-none"
            >
              Review extracted values
            </h1>
            <p className="truncate text-xs text-ink-faint">
              From {contract.fileName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p
              id={progressId}
              role="status"
              aria-live="polite"
              className="text-sm text-ink"
            >
              {found.length === 0 ? (
                "No values found"
              ) : pending.length === 0 ? (
                <span className="font-medium text-ok">
                  All {found.length} values decided
                </span>
              ) : (
                `${pending.length} of ${found.length} values to decide`
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={
                  !verified.some(
                    ({ path }) => decisions[path]?.kind === "pending",
                  )
                }
                onClick={() =>
                  setDecisions((current) => acceptAllVerified(fields, current))
                }
              >
                Accept all verified
              </Button>
              <Button
                size="sm"
                aria-disabled={pending.length > 0 || confirming || undefined}
                aria-describedby={progressId}
                onClick={confirm}
              >
                {confirming ? "Creating draft…" : "Create draft"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div
        ref={paneToggle}
        className="sticky top-0 z-20 border-b border-rule bg-paper/95 px-4 py-2 backdrop-blur lg:hidden"
      >
        <div
          role="group"
          aria-label="Show"
          className="grid grid-cols-2 rounded-sm border border-rule-strong bg-paper p-0.5 text-sm"
        >
          {(["fields", "source"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={pane === value}
              onClick={() => setPane(value)}
              className={`h-8 rounded-[3px] ${
                pane === value
                  ? "bg-ink font-medium text-white"
                  : "text-ink-soft"
              }`}
            >
              {value === "fields" ? "Values" : "Document"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 lg:grid-cols-[minmax(24rem,36rem)_minmax(0,1fr)]">
        <div
          className={`min-w-0 px-4 pt-6 pb-24 sm:px-8 ${
            pane === "fields" ? "" : "max-lg:hidden"
          }`}
        >
          <div className="mx-auto max-w-xl space-y-6">
            <Notice
              tone="hint"
              title="AI-extracted — review every value; not legal advice"
            >
              {contract.model} proposed these values with prompt{" "}
              {contract.promptVersion}. Urkundenwerk checked each quote against
              the document. Verified means the passage exists and states the
              value, not that it is the right value for the deed.
            </Notice>
            {contract.suspiciousSegments.length > 0 ? (
              <Notice
                tone="error"
                title="The document contains instructions to an AI"
              >
                Some passages read like instructions to an AI rather than
                contract text. Values quoted from them are not verified. Check
                the document&apos;s origin.
              </Notice>
            ) : null}
            {error ? <Notice tone="error">{error}</Notice> : null}

            {found.length === 0 ? (
              <div className="rounded-md border border-dashed border-rule-strong bg-paper px-6 py-10 text-center">
                <p className="font-serif text-xl">No values found</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                  The model found nothing for a Musterprotokoll in this
                  document. Try the formation deed or the articles of
                  association.
                </p>
                <Button
                  variant="secondary"
                  className="mt-5"
                  onClick={onRestart}
                >
                  Choose another file
                </Button>
              </div>
            ) : (
              REVIEW_SECTIONS.map((section) => {
                const inSection = fields.filter(
                  ({ path }) => sectionOf(path) === section.id,
                );
                const present = inSection.filter(
                  ({ status }) => status !== "absent",
                );
                const absent = inSection.filter(
                  ({ status }) => status === "absent",
                );
                const headingId = `review-section-${section.id}`;
                return (
                  <section
                    key={section.id}
                    aria-labelledby={headingId}
                    className="border-t border-rule pt-6 first-of-type:border-t-0"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <h2
                        id={headingId}
                        className="text-lg font-semibold tracking-tight text-ink"
                      >
                        {section.title}
                      </h2>
                      <span className="text-xs text-ink-faint">
                        {present.length === 0
                          ? "Nothing found"
                          : `${present.length} found`}
                      </span>
                    </div>
                    {present.length > 0 ? (
                      <ul className="mt-2">
                        {present.map((field) => (
                          <FieldRow
                            key={field.path}
                            field={field}
                            decision={decisions[field.path]}
                            active={activePath === field.path}
                            onDecide={deciders[field.path]}
                            onShowSource={() => showInSource(field.path)}
                          />
                        ))}
                      </ul>
                    ) : null}
                    {absent.length > 0 ? (
                      <p className="mt-3 text-sm text-ink-faint">
                        Not found in the document:{" "}
                        {absent.map(({ path }) => fieldLabel(path)).join(", ")}.
                        You can fill these in the builder.
                      </p>
                    ) : null}
                  </section>
                );
              })
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-6">
              <Button
                aria-disabled={pending.length > 0 || confirming || undefined}
                onClick={confirm}
              >
                {confirming ? "Creating draft…" : "Create draft"}
              </Button>
              <Button variant="quiet" onClick={onRestart}>
                Import another file
              </Button>
              <p className="w-full text-sm text-ink-faint">
                The draft gets the {accepted.length} values you accepted or
                edited. The builder then checks them against the GmbHG like any
                other draft.
              </p>
            </div>
          </div>
        </div>

        <div
          className={`min-w-0 border-rule bg-desk lg:border-l ${
            pane === "source" ? "" : "max-lg:hidden"
          }`}
        >
          <section
            aria-label="Source document"
            className="px-3 py-6 sm:px-8 lg:sticky lg:top-[var(--builder-sticky,4.5rem)] lg:max-h-[calc(100dvh-var(--builder-sticky,4.5rem))] lg:overflow-y-auto lg:py-10"
          >
            <SourceSheet
              source={source}
              citations={citations}
              activePath={activePath}
              suspiciousSegments={contract.suspiciousSegments}
              onSelect={selectFromSource}
            />
            <p className="mx-auto mt-4 max-w-[52rem] text-xs text-ink-soft">
              The text as Urkundenwerk read it from {contract.fileName}. Marked
              passages are the quotes behind the values; select one to go to its
              value.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
