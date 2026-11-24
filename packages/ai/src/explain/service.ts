import { getRule, type IssueParams, type RuleCode } from "@urkundenwerk/core";
import { z } from "zod";
import { isLlmError, type LlmErrorKind } from "../errors";
import type { FakeResponder } from "../fake";
import type { LlmClient } from "../port";
import {
  type ExplainableIssue,
  type ExplanationItem,
  issueKey,
  toExplanationItems,
} from "./payload";
import {
  type ExplanationLocale,
  explanationSystemPrompt,
  PROMPT_VERSION,
  userMessage,
} from "./prompt";

/** The JSON the model must return; checked again entry by entry below. */
export const explanationOutputSchema = z.object({
  explanations: z.array(
    z.object({
      code: z.string(),
      explanation: z.string(),
      suggestedFix: z.string(),
    }),
  ),
});

export type ExplanationOutput = z.infer<typeof explanationOutputSchema>;

export interface Explanation {
  code: RuleCode;
  params: IssueParams;
  explanation: string;
  /** What to change, or `null` for the deterministic fallback. */
  suggestedFix: string | null;
  /** "model" for AI-generated text, "rule" for the rule's own summary. */
  source: "model" | "rule";
}

export interface ExplanationResult {
  explanations: Explanation[];
  /** The language the model was asked to write in. */
  locale: ExplanationLocale;
  /** The model that wrote the explanations, or `null` if none did. */
  model: string | null;
  promptVersion: string;
  /** Why some entries fell back to the rule summary, if any did. */
  failure: LlmErrorKind | "disabled" | "rejected_entries" | null;
}

export type CachedExplanation = Pick<
  Explanation,
  "explanation" | "suggestedFix"
> & {
  /** The model that wrote it, as the provider reported it. */
  model: string;
};

export interface ExplanationCache {
  get(key: string): CachedExplanation | undefined;
  set(key: string, value: CachedExplanation): void;
}

export interface ExplainOptions {
  templateId: string;
  /** The UI language; the model answers in it. */
  locale: ExplanationLocale;
  /** `null` when AI is disabled; every entry then falls back. */
  client: LlmClient | null;
  model: string;
  cache?: ExplanationCache;
  signal?: AbortSignal;
}

const MAX_EXPLANATION_SENTENCES = 3;
const MAX_EXPLANATION_LENGTH = 700;
const MAX_FIX_LENGTH = 300;
const MAX_OUTPUT_TOKENS = 4_096;

// Abbreviations in citations end in a full stop but do not end a sentence.
const ABBREVIATIONS = /\b(?:Abs|Nr|Art|Satz|bzw|ca|vgl|z\. B|e\.g|i\.e)\./g;

/** Counts sentences, ignoring the full stops of common abbreviations. */
export function sentenceCount(text: string): number {
  return text
    .replace(ABBREVIATIONS, "")
    .split(/[.!?]+(?:\s+|$)/)
    .filter((part) => part.trim() !== "").length;
}

function acceptable(entry: ExplanationOutput["explanations"][number]) {
  const explanation = entry.explanation.trim();
  const fix = entry.suggestedFix.trim();
  return (
    explanation !== "" &&
    explanation.length <= MAX_EXPLANATION_LENGTH &&
    sentenceCount(explanation) <= MAX_EXPLANATION_SENTENCES &&
    fix !== "" &&
    fix.length <= MAX_FIX_LENGTH
  );
}

/** Explanations are cached per issue, language, model, and prompt version. */
export function explanationCacheKey(
  item: ExplainableIssue,
  locale: ExplanationLocale,
  model: string,
): string {
  return JSON.stringify([issueKey(item), locale, model, PROMPT_VERSION]);
}

function fallback(item: ExplanationItem): Explanation {
  return {
    code: item.code,
    params: item.params,
    explanation: item.summary,
    suggestedFix: null,
    source: "rule",
  };
}

/**
 * Explains issues that the rules already found. The model receives only rule
 * codes, legal references, rule summaries, and non-personal params. Its
 * answers are checked: entries for codes that were not asked about are
 * dropped, overlong ones are rejected, and any failure falls back to the
 * rule's deterministic summary. Rules decide; this only explains (ADR-0002).
 */
export async function explainIssues(
  issues: readonly ExplainableIssue[],
  { templateId, locale, client, model, cache, signal }: ExplainOptions,
): Promise<ExplanationResult> {
  const items = toExplanationItems(templateId, issues);
  const answers = new Map<string, Explanation>();
  let usedModel: string | null = null;
  let failure: ExplanationResult["failure"] = null;

  if (client) {
    for (const item of items) {
      const cached = cache?.get(explanationCacheKey(item, locale, model));
      if (!cached) continue;
      answers.set(issueKey(item), {
        ...fallback(item),
        explanation: cached.explanation,
        suggestedFix: cached.suggestedFix,
        source: "model",
      });
      usedModel = cached.model;
    }
  }

  // The model answers by code, so a second issue with the same code but
  // other params keeps the deterministic summary.
  const pending = new Map<string, ExplanationItem>();
  for (const item of items) {
    if (!answers.has(issueKey(item)) && !pending.has(item.code)) {
      pending.set(item.code, item);
    }
  }

  if (pending.size > 0 && !client) {
    failure = "disabled";
  } else if (pending.size > 0 && client) {
    try {
      const result = await client.generateStructured({
        task: "explain",
        system: explanationSystemPrompt(locale),
        user: userMessage(templateId, locale, [...pending.values()]),
        schema: explanationOutputSchema,
        model,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        effort: "low",
        signal,
      });
      for (const entry of result.data.explanations) {
        const item = pending.get(entry.code);
        // Codes that were not asked about, or repeated, are dropped.
        if (!item) continue;
        pending.delete(entry.code);
        if (!acceptable(entry)) {
          failure = "rejected_entries";
          continue;
        }
        const answer = {
          explanation: entry.explanation.trim(),
          suggestedFix: entry.suggestedFix.trim(),
        };
        cache?.set(explanationCacheKey(item, locale, model), {
          ...answer,
          model: result.model,
        });
        answers.set(issueKey(item), {
          ...fallback(item),
          ...answer,
          source: "model",
        });
        usedModel = result.model;
      }
      if (pending.size > 0) failure ??= "rejected_entries";
    } catch (error) {
      if (!isLlmError(error)) throw error;
      failure = error.kind;
    }
  }

  return {
    explanations: items.map(
      (item) => answers.get(issueKey(item)) ?? fallback(item),
    ),
    locale,
    model: usedModel,
    promptVersion: PROMPT_VERSION,
    failure,
  };
}

const fakePayloadSchema = z.object({
  templateId: z.string(),
  language: z.enum(["de", "en"]),
  issues: z.array(z.object({ code: z.string() })),
});

const FAKE_TEXT = {
  de: {
    explanation: "Skriptgesteuerte Erläuterung für lokale Tests.",
    fix: "Korrigieren Sie das markierte Feld im Formular.",
  },
  en: {
    explanation: "Scripted explanation for local testing.",
    fix: "Correct the highlighted field in the form.",
  },
} as const;

/**
 * Answers explanation requests without a model, for end-to-end tests and
 * local development without a key. The text says that it is scripted and
 * is written in the requested language. English answers quote the rule
 * summary, which exists only in English.
 */
export const fakeExplanationResponder: FakeResponder = (request) => {
  const match = /<issues>\n([\s\S]*)\n<\/issues>/.exec(request.user);
  let payload: z.infer<typeof fakePayloadSchema>;
  try {
    payload = fakePayloadSchema.parse(JSON.parse(match?.[1] ?? ""));
  } catch {
    return { kind: "error", error: "rejected" };
  }
  const text = FAKE_TEXT[payload.language];
  return {
    kind: "output",
    output: {
      explanations: payload.issues.map(({ code }) => ({
        code,
        explanation:
          payload.language === "en"
            ? `${text.explanation} ${getRule(payload.templateId, code)?.summary ?? ""}`.trim()
            : text.explanation,
        suggestedFix: text.fix,
      })),
    },
  };
};
