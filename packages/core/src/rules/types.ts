export type Severity = "error" | "warning" | "info";

/** Severities from most to least serious. Errors block an export. */
export const SEVERITIES = ["error", "warning", "info"] as const;

/**
 * Structured facts about an issue, such as amounts and limits. Only numbers
 * and booleans are allowed, so params can never carry names, addresses, or
 * other free text from a draft. Explanations rely on this (ADR-0007).
 */
export type IssueParams = Readonly<Record<string, number | boolean>>;

/** A problem that a rule found in the data. */
export interface Issue<Code extends string = string> {
  /** The stable code of the rule that reported it. */
  readonly code: Code;
  readonly severity: Severity;
  /** Dot-separated field paths, the most relevant first. */
  readonly paths: readonly string[];
  readonly params: IssueParams;
  /**
   * A deterministic English sentence for logs, API diagnostics, and tests.
   * User interfaces word an issue from `code`, `params`, and `paths` in
   * their own language instead (ADR-0012), so core stays language-neutral.
   */
  readonly message: string;
}

/** Values a rule may depend on besides the data. */
export interface RuleContext {
  /**
   * Today's date as an ISO calendar date. Rules never read the clock, so the
   * same data and reference date always give the same issues.
   */
  readonly referenceDate: string;
}

/** What a rule reports for one problem; the engine adds code and severity. */
export interface Finding {
  readonly paths: readonly string[];
  readonly params?: IssueParams;
  readonly message: string;
}

export interface Rule<Input, Code extends string = string> {
  /** Stable code, kept across releases because clients and caches use it. */
  readonly id: Code;
  readonly templateId: string;
  readonly severity: Severity;
  /** The provision the rule enforces, e.g. "§ 5 Abs. 1 GmbHG". */
  readonly legalReference: string;
  /** One deterministic English sentence that states the rule. */
  readonly summary: string;
  /**
   * The field paths the rule reads and reports. Rules derived from the schema
   * report any of its paths and list none here.
   */
  readonly paths: readonly string[];
  check(input: Input, context: RuleContext): readonly Finding[];
}
