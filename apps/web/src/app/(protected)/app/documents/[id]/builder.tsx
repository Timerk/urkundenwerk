"use client";

import {
  buildMusterprotokollPreview,
  musterprotokollMetadata,
  type MusterprotokollDraft,
} from "@urkundenwerk/core";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { DocumentPreview } from "../../../../../components/document-preview";
import { Button } from "../../../../../components/ui/button";
import { Notice } from "../../../../../components/ui/notice";
import { fieldLabel } from "../../../../../lib/builder/fields";
import { DEFAULT_DOCUMENT_TITLE } from "../../../../../lib/documents/schemas";
import {
  analyseDraft,
  isFieldRule,
  legalFormOf,
  setAt,
  withDefaults,
} from "../../../../../lib/builder/form-model";
import {
  type SaveState,
  useAutosave,
} from "../../../../../lib/builder/use-autosave";
import { renameDocument, saveDraft } from "../actions";
import { BuilderForm } from "./builder-form";
import { ChecksPanel } from "./checks-panel";
import { DraftProvider } from "./draft-fields";

export type BuilderProps = {
  documentId: string;
  title: string;
  initialDraft: MusterprotokollDraft;
  updatedAt: string;
  canEdit: boolean;
  firmName: string;
  templateLabel: string;
  /** Today's date in Germany, from the server, for date rules. */
  referenceDate: string;
  /** Whether the server can explain issues with an LLM. */
  aiEnabled: boolean;
};

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

function SaveStatus({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry: () => void;
}) {
  let content;
  switch (state.status) {
    case "saved":
      content = state.savedAt
        ? `Saved at ${timeFormat.format(new Date(state.savedAt))}`
        : "All changes saved";
      break;
    case "unsaved":
      content = "Unsaved changes";
      break;
    case "saving":
      content = "Saving…";
      break;
    case "error":
      content = (
        <span className="text-alert">
          Not saved. {state.message}{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </span>
      );
  }
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 text-sm text-ink-faint"
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          state.status === "saved"
            ? "bg-ok"
            : state.status === "error"
              ? "bg-alert"
              : "bg-hint-rule"
        }`}
      />
      {content}
    </p>
  );
}

/** Moves focus to the control for `path` and marks it briefly. */
function focusControl(path: string): boolean {
  const target = document.querySelector<HTMLElement>(
    // Paths come from the document model and contain only letters and dots.
    `[data-field="${path}"]`,
  );
  if (!target) return false;
  const control =
    target instanceof HTMLFieldSetElement
      ? (target.querySelector<HTMLInputElement>("input:checked") ??
        target.querySelector<HTMLInputElement>("input"))
      : target;
  const marked = target instanceof HTMLFieldSetElement ? target : control;
  control?.focus({ preventScroll: true });
  (marked ?? target).scrollIntoView({
    block: "center",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
  marked?.classList.remove("field-located");
  // Restart the animation when the same field is chosen twice.
  void marked?.offsetWidth;
  marked?.classList.add("field-located");
  return true;
}

export function Builder({
  documentId,
  title: initialTitle,
  initialDraft,
  updatedAt,
  canEdit,
  firmName,
  templateLabel,
  referenceDate,
  aiEnabled,
}: BuilderProps) {
  const [draft, setDraft] = useState(() =>
    canEdit ? withDefaults(initialDraft) : initialDraft,
  );
  const [title, setTitle] = useState(initialTitle);
  const [titleInput, setTitleInput] = useState(initialTitle);
  const [titleError, setTitleError] = useState<string>();
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [activePath, setActivePath] = useState<string>();
  const [pane, setPane] = useState<"form" | "preview">("form");
  const [downloadError, setDownloadError] = useState<string>();
  const pendingFocus = useRef<string | null>(null);
  // Marks the builder as interactive once hydrated, for tests and styling.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const header = useRef<HTMLElement>(null);

  const paneToggle = useRef<HTMLDivElement>(null);

  // Whichever bar is sticky (the toolbar on wide screens, the pane toggle on
  // narrow ones) sets the offset for the preview and for scrolling focused
  // fields into view without hiding them underneath.
  useEffect(() => {
    const root = document.documentElement;
    const wide = window.matchMedia("(min-width: 64rem)");
    const measure = () => {
      const bar = wide.matches ? header.current : paneToggle.current;
      root.style.setProperty("--builder-sticky", `${bar?.offsetHeight ?? 0}px`);
    };
    const observer = new ResizeObserver(measure);
    if (header.current) observer.observe(header.current);
    if (paneToggle.current) observer.observe(paneToggle.current);
    wide.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      wide.removeEventListener("change", measure);
      root.style.removeProperty("--builder-sticky");
    };
  }, []);

  const analysis = useMemo(
    () => analyseDraft(draft, referenceDate),
    [draft, referenceDate],
  );
  const model = useMemo(() => buildMusterprotokollPreview(draft), [draft]);
  const legalForm = useMemo(
    () => legalFormOf(draft.company?.name),
    [draft.company?.name],
  );

  const save = useCallback(
    (value: MusterprotokollDraft) => saveDraft(documentId, value),
    [documentId],
  );
  const autosave = useAutosave({
    value: draft,
    save,
    enabled: canEdit,
    initialSavedAt: updatedAt,
  });

  const commitTitle = useCallback(
    async (next: string) => {
      const trimmed = next.trim();
      if (trimmed === title) {
        setTitleInput(title);
        setTitleError(undefined);
        return;
      }
      const result = await renameDocument(documentId, trimmed);
      if (result.ok) {
        setTitle(result.title);
        setTitleInput(result.title);
        setTitleError(undefined);
      } else {
        setTitleError(result.error);
      }
    },
    [documentId, title],
  );

  // A new document takes the Firma as its title until it is renamed.
  const companyName = draft.company?.name?.trim();
  useEffect(() => {
    if (!canEdit || title !== DEFAULT_DOCUMENT_TITLE || !companyName) return;
    const timeout = setTimeout(
      () => void commitTitle(companyName.slice(0, 120)),
      1500,
    );
    return () => clearTimeout(timeout);
  }, [canEdit, title, companyName, commitTitle]);

  // After switching to the form pane, move focus once it is rendered.
  useEffect(() => {
    if (pane === "form" && pendingFocus.current) {
      focusControl(pendingFocus.current);
      pendingFocus.current = null;
    }
  }, [pane]);

  const selectFromPreview = useCallback(
    (path: string) => {
      if (pane === "preview") {
        pendingFocus.current = path;
        setPane("form");
      } else {
        focusControl(path);
      }
    },
    [pane],
  );

  const revealMissing = useCallback(() => {
    setShowAll(true);
    const first = analysis.issues.keys().next().value;
    if (first) selectFromPreview(first);
  }, [analysis, selectFromPreview]);

  const download = useCallback(
    async (format: "pdf" | "docx") => {
      setDownloadError(undefined);
      if (!analysis.complete) {
        revealMissing();
        return;
      }
      // The export reads the stored draft, so pending edits are saved first.
      if (canEdit && !(await autosave.flush())) {
        setDownloadError("Save the latest changes before downloading.");
        return;
      }
      const link = document.createElement("a");
      link.href = `/app/documents/${documentId}/export?format=${format}`;
      link.download = "";
      document.body.append(link);
      link.click();
      link.remove();
    },
    [analysis.complete, autosave, canEdit, documentId, revealMissing],
  );

  const context = useMemo(
    () => ({
      draft,
      readOnly: !canEdit,
      update: (path: string, value: unknown) =>
        setDraft((current) => setAt(current, path, value)),
      visibleIssue: (path: string) => {
        const issue = analysis.issues.get(path);
        if (!issue) return undefined;
        // Rules show as soon as their values exist; missing values once the
        // field was visited or the user asked for all of them.
        return !isFieldRule(issue.code) || showAll || touched.has(path)
          ? issue
          : undefined;
      },
      touch: (path: string) =>
        setTouched((current) =>
          current.has(path) ? current : new Set(current).add(path),
        ),
      setActivePath,
    }),
    [draft, canEdit, analysis, showAll, touched],
  );

  const outstanding = analysis.complete ? 0 : analysis.outstanding;
  const readinessId = "builder-readiness";

  return (
    <DraftProvider value={context}>
      <div
        className="flex min-h-0 flex-1 flex-col"
        data-builder-ready={ready || undefined}
      >
        <header
          ref={header}
          className="z-20 border-b border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85 lg:sticky lg:top-0"
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Link
                href="/app"
                className="inline-flex shrink-0 items-center gap-1 rounded-sm text-sm text-ink-soft hover:text-ink"
              >
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
                  <path
                    d="M10 3.5 5.5 8l4.5 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Documents
              </Link>
              <span aria-hidden="true" className="h-6 w-px bg-rule" />
              <div className="min-w-0 flex-1">
                {canEdit ? (
                  <>
                    <label htmlFor="document-title" className="sr-only">
                      Document title
                    </label>
                    <input
                      id="document-title"
                      value={titleInput}
                      maxLength={120}
                      aria-invalid={titleError ? true : undefined}
                      aria-describedby={
                        titleError ? "document-title-error" : undefined
                      }
                      onChange={(event) => setTitleInput(event.target.value)}
                      onBlur={() => void commitTitle(titleInput)}
                      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          setTitleInput(title);
                          event.currentTarget.blur();
                        }
                      }}
                      className="w-full truncate rounded-sm border border-transparent bg-transparent px-1.5 py-0.5 font-serif text-lg text-ink sm:text-xl hover:border-rule focus:border-rule-strong focus:bg-paper"
                    />
                  </>
                ) : (
                  <h1 className="truncate px-1.5 font-serif text-xl text-ink">
                    {title}
                  </h1>
                )}
                <p className="truncate px-1.5 text-xs text-ink-faint">
                  {templateLabel} in {firmName}
                </p>
                {titleError ? (
                  <p
                    id="document-title-error"
                    className="px-1.5 text-xs text-alert"
                  >
                    {titleError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {canEdit ? (
                <SaveStatus
                  state={autosave.state}
                  onRetry={() => void autosave.flush()}
                />
              ) : null}
              <p id={readinessId} className="text-sm">
                {outstanding === 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-ok">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      className="size-4"
                    >
                      <path
                        d="m3.5 8.5 3 3 6-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Ready to export
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={revealMissing}
                    className="rounded-sm font-medium text-ink underline decoration-hint-rule decoration-2 underline-offset-4 hover:decoration-ink"
                  >
                    {outstanding === 1
                      ? "1 field to complete"
                      : `${outstanding} fields to complete`}
                  </button>
                )}
              </p>
              <div className="flex gap-2">
                {(["pdf", "docx"] as const).map((format) => (
                  <Button
                    key={format}
                    variant={format === "pdf" ? "primary" : "secondary"}
                    size="sm"
                    aria-disabled={!analysis.complete || undefined}
                    aria-describedby={readinessId}
                    onClick={() => void download(format)}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      className="size-3.5"
                    >
                      <path
                        d="M8 2.5v8m0 0L4.75 7.25M8 10.5l3.25-3.25M3 13.5h10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Download {format.toUpperCase()}
                  </Button>
                ))}
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
            {(["form", "preview"] as const).map((value) => (
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
                {value === "form" ? "Form" : "Preview"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid flex-1 lg:grid-cols-[minmax(24rem,36rem)_minmax(0,1fr)]">
          <div
            className={`min-w-0 px-4 pt-6 pb-24 sm:px-8 ${
              pane === "form" ? "" : "max-lg:hidden"
            }`}
          >
            <div className="mx-auto max-w-xl space-y-4">
              {!canEdit ? (
                <Notice title="Read only">
                  You can read and download this document. Editing needs the
                  editor or admin role in {firmName}.
                </Notice>
              ) : null}
              {downloadError ? (
                <Notice tone="error">{downloadError}</Notice>
              ) : null}
              {showAll && !analysis.complete ? (
                <Notice tone="hint" title="Still missing">
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {[...analysis.issues.keys()].map((path) => (
                      <li key={path}>
                        <button
                          type="button"
                          onClick={() => selectFromPreview(path)}
                          className="underline underline-offset-2 hover:text-ink"
                        >
                          {fieldLabel(path)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Notice>
              ) : null}
              <ChecksPanel
                documentId={documentId}
                issues={analysis.checks}
                aiEnabled={aiEnabled}
                onLocate={selectFromPreview}
              />
              <form
                aria-label="Musterprotokoll data"
                onSubmit={(event) => event.preventDefault()}
                noValidate
              >
                <BuilderForm
                  draft={draft}
                  issues={analysis.issues}
                  legalForm={legalForm}
                />
              </form>
            </div>
          </div>

          <div
            className={`min-w-0 border-rule bg-desk lg:border-l ${
              pane === "preview" ? "" : "max-lg:hidden"
            }`}
          >
            <section
              aria-label="Preview"
              className="lg:sticky lg:top-[var(--builder-sticky,5.5rem)] lg:max-h-[calc(100dvh-var(--builder-sticky,5.5rem))] lg:overflow-y-auto px-3 py-6 sm:px-8 lg:py-10"
            >
              <div className="deed-sheet mx-auto max-w-[52rem]">
                <DocumentPreview
                  model={model}
                  activePath={activePath}
                  onSelect={selectFromPreview}
                />
              </div>
              <p className="mx-auto mt-4 max-w-[52rem] text-xs text-ink-soft">
                Wording of {musterprotokollMetadata.legalBasis}, version{" "}
                {model.templateVersion}. Values in blue come from the form;
                select one to edit it. Page breaks are set in the PDF.
              </p>
            </section>
          </div>
        </div>
      </div>
    </DraftProvider>
  );
}
