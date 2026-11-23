import { isoDateSchema } from "../formatting";
import {
  type Issue,
  type Rule,
  type RuleContext,
  SEVERITIES,
  type Severity,
} from "./types";

const rank = (severity: Severity) => SEVERITIES.indexOf(severity);

/**
 * Runs every rule of a rule set and returns the issues sorted by severity.
 * Within one severity, issues keep the order of the rule set and then of each
 * rule's findings, so the result is stable.
 */
export function evaluateRules<Input, Code extends string>(
  rules: readonly Rule<Input, Code>[],
  input: Input,
  context: RuleContext,
): Issue<Code>[] {
  if (!isoDateSchema.safeParse(context.referenceDate).success) {
    throw new RangeError("Expected the reference date as an ISO date");
  }
  const issues = rules.flatMap((rule) =>
    rule.check(input, context).map((finding): Issue<Code> => ({
      code: rule.id,
      severity: rule.severity,
      paths: finding.paths,
      params: finding.params ?? {},
      message: finding.message,
    })),
  );
  // Array.prototype.sort is stable, so the rule order survives within a severity.
  return issues.sort((a, b) => rank(a.severity) - rank(b.severity));
}

/** True when none of the issues blocks an export. */
export function passes(issues: readonly Issue[]): boolean {
  return issues.every((issue) => issue.severity !== "error");
}
