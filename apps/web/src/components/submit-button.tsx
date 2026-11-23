"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./ui/button";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  disabled,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending || disabled}
      aria-disabled={pending || disabled || undefined}
      className={className}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
