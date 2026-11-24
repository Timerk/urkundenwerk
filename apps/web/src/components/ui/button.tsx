import type { ComponentPropsWithRef, ReactNode } from "react";

export type ButtonVariant =
  "primary" | "secondary" | "quiet" | "danger" | "destructive";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white hover:bg-stamp-deep disabled:bg-rule-strong aria-disabled:bg-rule-strong aria-disabled:hover:bg-rule-strong",
  secondary:
    "border border-rule-strong bg-paper text-ink hover:border-ink hover:bg-surface disabled:text-ink-faint aria-disabled:text-ink-faint aria-disabled:hover:border-rule-strong aria-disabled:hover:bg-paper",
  quiet:
    "text-ink-soft hover:bg-desk hover:text-ink disabled:text-ink-faint aria-disabled:text-ink-faint",
  danger:
    "border border-transparent text-alert hover:border-alert hover:bg-alert-wash",
  /** The final, confirming step of a destructive action. */
  destructive:
    "bg-alert text-white hover:bg-[#8f1e18] disabled:bg-rule-strong aria-disabled:bg-rule-strong",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

/** Class names for a button, also used to style links that act as buttons. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  children,
  ...props
}: ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  );
}
