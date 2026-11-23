"use client";

import type { Explanation, ExplanationResult } from "@urkundenwerk/ai";
import {
  getRule,
  type MusterprotokollIssue,
  musterprotokollMetadata,
  type Severity,
} from "@urkundenwerk/core";
import { useCallback, useState } from "react";
import { fieldLabel } from "../../../../../lib/builder/fields";
import { explainDocumentIssues } from "../actions";

type ExplanationState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "done";
      explanation: Explanation;
      model: string | null;
      promptVersion: string;
    };

/** Identifies an issue by what the explanation depends on. */
function keyOf({
  code,
  params,
}: Pick<MusterprotokollIssue, "code" | "params">) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => [key, params[key]]);
  return JSON.stringify([code, sorted]);
}

const GROUPS: { severity: Severity; title: string; description: string }[] = [
  {
    severity: "error",
    title: "To correct",
    description: "These block the download.",
  },
  {
    severity: "warning",
    title: "Worth checking",
    description: "Registry courts may object.",
  },
  { severity: "info", title: "Notes", description: "No action needed." },
];

const TONES: Record<Severity, string> = {
  error: "border-alert",
  warning: "border-hint-rule",
  info: "border-stamp/40",
};

function ExplanationView({ state }: { state: ExplanationState }) {
  if (state.status === "loading") {
    return <p className="text-sm text-ink-faint">Writing an explanation…</p>;
  }
  if (state.status === "error") {
    return <p className="text-sm text-alert">{state.message}</p>;
  }
  const { explanation, model, promptVersion } = state;
  if (explanation.source === "rule") {
    return (
      <div className="rounded-sm border border-rule bg-surface px-3 py-2 text-sm text-ink-soft">
        <p>{explanation.explanation}</p>
        <p className="mt-1 text-xs text-ink-faint">
          The rule&apos;s own summary. An AI explanation is not available right
          now.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-sm border border-stamp/25 bg-stamp-wash px-3 py-2 text-sm text-ink">
      <p className="text-xs font-medium text-stamp-deep">
        AI-generated explanation — not legal advice
      </p>
      <p className="mt-1">{explanation.explanation}</p>
      {explanation.suggestedFix ? (
        <p className="mt-1">
          <span className="font-medium">Suggested fix:</span>{" "}
          {explanation.suggestedFix}
        </p>
      ) : null}
      <p className="mt-1.5 text-2xs text-ink-faint">
        Model {model ?? "unknown"}, prompt {promptVersion}
      </p>
    </div>
  );
}

function resultStates(result: ExplanationResult): [string, ExplanationState][] {
  return result.explanations.map((explanation) => [
    keyOf(explanation),
    {
      status: "done",
      explanation,
      model: result.model,
      promptVersion: result.promptVersion,
    },
  ]);
}

/**
 * The rule engine's findings about the law, grouped by severity. Each links
 * to its field and can be explained by an LLM on request. The rules decide;
 * an explanation never changes an issue.
 */
export function ChecksPanel({
  documentId,
  issues,
  aiEnabled,
  onLocate,
}: {
  documentId: string;
  issues: readonly MusterprotokollIssue[];
  aiEnabled: boolean;
  onLocate: (path: string) => void;
}) {
  const [explanations, setExplanations] = useState<
    ReadonlyMap<string, ExplanationState>
  >(new Map());

  const request = useCallback(
    async (targets: readonly MusterprotokollIssue[]) => {
      const keys = targets.map(keyOf);
      const update = (entries: [string, ExplanationState][]) =>
        setExplanations((current) => new Map([...current, ...entries]));
      update(keys.map((key) => [key, { status: "loading" }]));
      try {
        const result = await explainDocumentIssues(
          documentId,
          targets.map(({ code, params }) => ({ code, params })),
        );
        if (result.ok) {
          update(resultStates(result.result));
        } else {
          update(
            keys.map((key) => [
              key,
              { status: "error", message: result.error },
            ]),
          );
        }
      } catch {
        update(
          keys.map((key) => [
            key,
            {
              status: "error",
              message: "The explanation could not be loaded. Try again.",
            },
          ]),
        );
      }
    },
    [documentId],
  );

  const unexplained = issues.filter((issue) => {
    const state = explanations.get(keyOf(issue));
    return !state || state.status === "error";
  });
  const loading = issues.some(
    (issue) => explanations.get(keyOf(issue))?.status === "loading",
  );

  return (
    <section
      aria-labelledby="checks-heading"
      className="rounded-md border border-rule bg-paper"
      data-testid="checks-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule px-4 py-3">
        <div>
          <h2
            id="checks-heading"
            className="text-base font-semibold tracking-tight text-ink"
          >
            Checks
          </h2>
          <p className="text-xs text-ink-faint">
            Rules for {musterprotokollMetadata.legalBasis}, run as you type.
          </p>
        </div>
        {aiEnabled && issues.length > 1 ? (
          <button
            type="button"
            onClick={() => void request(unexplained)}
            disabled={unexplained.length === 0 || loading}
            className="rounded-sm text-sm font-medium text-stamp underline decoration-stamp/30 underline-offset-4 hover:decoration-stamp disabled:text-ink-faint disabled:no-underline"
          >
            Explain all
          </button>
        ) : null}
      </div>

      {issues.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-ok">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
            <path
              d="m3.5 8.5 3 3 6-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          All checks pass
        </p>
      ) : (
        <div className="divide-y divide-rule">
          {GROUPS.map(({ severity, title, description }) => {
            const group = issues.filter((issue) => issue.severity === severity);
            if (group.length === 0) return null;
            const headingId = `checks-${severity}`;
            return (
              <section
                key={severity}
                aria-labelledby={headingId}
                className="px-4 py-3"
              >
                <h3 id={headingId} className="text-sm font-medium text-ink">
                  {title}{" "}
                  <span className="font-normal text-ink-faint">
                    ({group.length}) {description}
                  </span>
                </h3>
                <ul className="mt-2 space-y-3">
                  {group.map((issue) => {
                    const key = keyOf(issue);
                    const state = explanations.get(key);
                    const path = issue.paths[0];
                    const rule = getRule(
                      musterprotokollMetadata.id,
                      issue.code,
                    );
                    return (
                      <li
                        key={`${key}-${path}`}
                        className={`space-y-1.5 border-l-[3px] pl-3 ${TONES[severity]}`}
                        data-issue={issue.code}
                      >
                        <p className="text-sm text-ink">{issue.message}</p>
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                          {rule ? (
                            <span className="font-serif text-sm text-ink-soft">
                              {rule.legalReference}
                            </span>
                          ) : null}
                          {path ? (
                            <button
                              type="button"
                              onClick={() => onLocate(path)}
                              className="rounded-sm text-ink-soft underline underline-offset-2 hover:text-ink"
                            >
                              Go to {fieldLabel(path)}
                            </button>
                          ) : null}
                          {aiEnabled && (!state || state.status === "error") ? (
                            <button
                              type="button"
                              onClick={() => void request([issue])}
                              className="rounded-sm font-medium text-stamp underline decoration-stamp/30 underline-offset-2 hover:decoration-stamp"
                            >
                              {state ? "Try again" : "Explain"}
                            </button>
                          ) : null}
                        </div>
                        <div aria-live="polite">
                          {state ? <ExplanationView state={state} /> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {!aiEnabled ? (
        <p className="border-t border-rule px-4 py-2 text-xs text-ink-faint">
          AI explanations are turned off on this server. Each check still names
          its legal basis.
        </p>
      ) : null}
    </section>
  );
}
