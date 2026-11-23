import type { ReactNode } from "react";

export type NoticeTone = "neutral" | "error" | "hint" | "success";

const tones: Record<NoticeTone, string> = {
  neutral: "border-rule-strong bg-paper text-ink",
  error: "border-alert bg-alert-wash text-alert",
  hint: "border-hint-rule bg-hint-wash text-hint",
  success: "border-ok/40 bg-paper text-ok",
};

/**
 * An inline message about a whole form or page. Errors are announced
 * assertively, everything else politely.
 */
export function Notice({
  tone = "neutral",
  title,
  children,
  className = "",
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-sm border-l-[3px] border-y border-r px-4 py-3 text-sm ${tones[tone]} ${className}`}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>
    </div>
  );
}

/** A titled group of content on a page. */
export function Section({
  title,
  description,
  actions,
  children,
  className = "",
  headingLevel = 2,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Heading className="text-lg font-semibold tracking-tight text-ink">
            {title}
          </Heading>
          {description ? (
            <p className="max-w-prose text-sm text-ink-soft">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
