"use client";

import type {
  ExtractionFieldPath,
  FieldReview,
} from "@urkundenwerk/extraction/contract";
import { type FieldKind, fieldKind } from "@urkundenwerk/extraction/contract";
import { useLocale, useTranslations } from "next-intl";
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
import { useFieldLabels } from "../../../../lib/builder/fields";
import { dateInputHint } from "../../../../lib/date-input";
import {
  acceptAllVerified,
  type Decision,
  type Decisions,
  decisionCounts,
  draftFromDecisions,
  editText,
  fieldOptions,
  formatValue,
  initialDecisions,
  type OptionLabel,
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

/** Option labels as the builder shows them. */
function useOptionLabel(): OptionLabel {
  const t = useTranslations("options");
  return (path, value) => {
    const group = {
      "notarisation.mode": "mode",
      "founder.kind": "founderKind",
      contribution: "contribution",
      "managingDirector.kind": "directorKind",
    }[path as string];
    const key = `${group}.${value}`;
    return group && t.has(key as never) ? t(key as never) : value;
  };
}

function StatusBadge({ field }: { field: FieldReview }) {
  const t = useTranslations("review");
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
        {t("verified")}
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
      {t("unverified")}
    </span>
  );
}

const DECISIONS = ["accepted", "edited", "cleared"] as const;

/** How a value that could not be read is described, by field kind. */
const UNREADABLE = {
  text: "text",
  freeText: "text",
  date: "date",
  amount: "amount",
  enum: "enum",
} as const satisfies Record<FieldKind["type"], string>;

function DecisionControl({
  field,
  choice,
  onChoose,
}: {
  field: FieldReview;
  choice: "accepted" | "edited" | "cleared" | undefined;
  onChoose: (kind: "accepted" | "edited" | "cleared") => void;
}) {
  const t = useTranslations("review");
  const label = useFieldLabels().label(field.path);
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t("decisionFor", { field: label })}</legend>
      <div className="inline-flex rounded-sm border border-rule-strong bg-paper p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stamp">
        {DECISIONS.map((kind) => {
          const checked = choice === kind;
          // A value that could not be read can only be edited or cleared.
          const disabled = kind === "accepted" && field.value === null;
          return (
            <label
              key={kind}
              className={`relative flex min-h-8 cursor-pointer items-center justify-center rounded-[3px] px-3.5 text-sm transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:text-ink-faint/60 ${
                checked
                  ? "bg-ink font-medium text-white"
                  : "text-ink-soft hover:bg-surface hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name={`decision-${field.path}`}
                value={kind}
                checked={checked}
                disabled={disabled}
                onChange={() => onChoose(kind)}
                className="absolute inset-0 cursor-[inherit] opacity-0"
              />
              {t(`decisions.${kind}`)}
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
  const locale = useLocale();
  const result = useMemo(
    () => parseEdit(field.path, text, locale),
    [field.path, text, locale],
  );
  const kind = fieldKind(field.path);
  const t = useTranslations("review");
  const builder = useTranslations("builder");
  const optionLabel = useOptionLabel();
  const label = t("newValue", { field: useFieldLabels().label(field.path) });
  const error = result.ok
    ? undefined
    : result.problem === "amountFormat"
      ? builder("euro.wholeFormat")
      : result.problem === "amountRange"
        ? builder("euro.wholeRange")
        : t(`edit.${result.problem}`);

  useEffect(() => {
    onValue(result.ok ? result.value : undefined);
  }, [result, onValue]);

  return (
    <Field
      label={label}
      error={error}
      description={
        kind.type === "date"
          ? builder("hints.dateFormat", { pattern: dateInputHint(locale) })
          : undefined
      }
    >
      {(ids) =>
        kind.type === "enum" ? (
          <Select
            ids={ids}
            value={text}
            onChange={(event) => setText(event.target.value)}
          >
            <option value="">{t("choose")}</option>
            {fieldOptions(field.path, optionLabel).map((option) => (
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
            inputMode={
              kind.type === "amount" || kind.type === "date"
                ? "numeric"
                : undefined
            }
            placeholder={
              kind.type === "date" ? dateInputHint(locale) : undefined
            }
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
  const t = useTranslations("review");
  const locale = useLocale();
  const optionLabel = useOptionLabel();
  const labels = useFieldLabels();
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
          {labels.label(field.path)}
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
          formatValue(field.path, field.value, locale, optionLabel)
        ) : (
          <span className="text-ink-faint">
            “{field.text}” <span className="text-sm">{t("unreadable")}</span>
          </span>
        )}
      </p>

      {field.reasons.length > 0 ? (
        <ul className="space-y-1 rounded-sm border-l-2 border-hint-rule bg-hint-wash px-2.5 py-1.5 text-sm text-hint">
          {field.reasons.map((reason) => (
            <li key={reason.code}>
              {reason.code === "value_unreadable"
                ? t(
                    `reasons.value_unreadable.${UNREADABLE[fieldKind(field.path).type]}`,
                  )
                : t(`reasons.${reason.code}`)}
            </li>
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
          <span className="font-medium text-ink-soft">{t("modelNote")}</span>{" "}
          {field.note}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
        <DecisionControl field={field} choice={choice} onChoose={choose} />
        {field.citation ? (
          <button
            type="button"
            onClick={onShowSource}
            aria-label={t("showPassage", { field: labels.label(field.path) })}
            className="rounded-sm text-sm font-medium text-stamp underline decoration-stamp/30 underline-offset-4 hover:decoration-stamp"
          >
            {t("showInDocument")}
          </button>
        ) : field.quote ? (
          <span className="text-sm text-ink-faint">{t("quoteMissing")}</span>
        ) : null}
      </div>
      {choice === "edited" ? (
        <EditControl
          field={field}
          initial={editText(field.path, field.value, locale)}
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
  const t = useTranslations("review");
  const common = useTranslations("common");
  const labels = useFieldLabels();

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
          ? t("oneUndecided", { field: labels.label(first.path) })
          : t("manyUndecided", { count: pending.length }),
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
        {
          model: contract.model,
          promptVersion: contract.promptVersion,
          counts: decisionCounts(fields, decisions),
        },
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
              {t("title")}
            </h1>
            <p className="truncate text-xs text-ink-faint">
              {t("from", { file: contract.fileName })}
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
                t("progress.none")
              ) : pending.length === 0 ? (
                <span className="font-medium text-ok">
                  {t("progress.done", { count: found.length })}
                </span>
              ) : (
                t("progress.pending", {
                  pending: pending.length,
                  count: found.length,
                })
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
                {t("acceptAll")}
              </Button>
              <Button
                size="sm"
                aria-disabled={pending.length > 0 || confirming || undefined}
                aria-describedby={progressId}
                onClick={confirm}
              >
                {confirming ? t("creating") : t("create")}
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
          aria-label={common("show")}
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
              {t(`panes.${value}`)}
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
            <Notice tone="hint" title={t("aiNotice.title")}>
              {t("aiNotice.body", {
                model: contract.model,
                prompt: contract.promptVersion,
              })}
            </Notice>
            {contract.suspiciousSegments.length > 0 ? (
              <Notice tone="error" title={t("suspicious.title")}>
                {t("suspicious.body")}
              </Notice>
            ) : null}
            {error ? <Notice tone="error">{error}</Notice> : null}

            {found.length === 0 ? (
              <div className="rounded-md border border-dashed border-rule-strong bg-paper px-6 py-10 text-center">
                <p className="font-serif text-xl">{t("empty.title")}</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                  {t("empty.body")}
                </p>
                <Button
                  variant="secondary"
                  className="mt-5"
                  onClick={onRestart}
                >
                  {t("empty.another")}
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
                        {t(`sections.${section.id}`)}
                      </h2>
                      <span className="text-xs whitespace-nowrap text-ink-faint">
                        {present.length === 0
                          ? t("nothingFound")
                          : t("found", { count: present.length })}
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
                        {t("absent", {
                          fields: absent
                            .map(({ path }) => labels.label(path))
                            .join(", "),
                        })}
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
                {confirming ? t("creating") : t("create")}
              </Button>
              <Button variant="quiet" onClick={onRestart}>
                {t("importAnother")}
              </Button>
              <p className="w-full text-sm text-ink-faint">
                {t("summary", { count: accepted.length })}
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
            aria-label={t("sourceLabel")}
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
              {t("sourceNote", { file: contract.fileName })}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
