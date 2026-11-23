import {
  getRule,
  type IssueParams,
  type RuleCode,
  type Severity,
} from "@urkundenwerk/core";
import { z } from "zod";

/**
 * Params as they may cross the trust boundary: a few short camel-case keys
 * with finite numbers or booleans. Free text cannot pass this schema.
 */
export const issueParamsSchema = z
  .record(
    z.string().regex(/^[a-zA-Z]{1,40}$/),
    z.union([z.number().finite(), z.boolean()]),
  )
  .refine((params) => Object.keys(params).length <= 8, {
    error: "has too many entries",
  });

/** What a caller may ask to have explained: a rule code and its params. */
export const explainableIssueSchema = z.strictObject({
  code: z.string().regex(/^[a-z_]{1,64}$/),
  params: issueParamsSchema,
});

export type ExplainableIssue = { code: string; params: IssueParams };

/**
 * One issue as the model sees it. Every field comes from the rule registry
 * except `params`, which holds only numbers and booleans. Names, dates of
 * birth, addresses, the Firma, and any other text from a draft have no field
 * to travel in (ADR-0007).
 */
export type ExplanationItem = Readonly<{
  code: RuleCode;
  severity: Severity;
  legalReference: string;
  summary: string;
  params: IssueParams;
}>;

/** A stable key for an issue: its code and its params in key order. */
export function issueKey({ code, params }: ExplainableIssue): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => [key, params[key]]);
  return JSON.stringify([code, sorted]);
}

/**
 * Builds the model payload from issues. Unknown codes are dropped, params are
 * validated again, and duplicates are merged. Only registry facts are copied;
 * anything else on the incoming objects is ignored.
 */
export function toExplanationItems(
  templateId: string,
  issues: readonly ExplainableIssue[],
): ExplanationItem[] {
  const items = new Map<string, ExplanationItem>();
  for (const issue of issues) {
    const rule = getRule(templateId, issue.code);
    const params = issueParamsSchema.safeParse(issue.params);
    if (!rule || !params.success) continue;
    const item: ExplanationItem = {
      code: rule.id,
      severity: rule.severity,
      legalReference: rule.legalReference,
      summary: rule.summary,
      params: params.data,
    };
    const key = issueKey(item);
    if (!items.has(key)) items.set(key, item);
  }
  return [...items.values()];
}
