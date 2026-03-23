import * as React from "react";
import { cn } from "~/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-[var(--radius-sm)] bg-[var(--input-bg)] border border-[var(--input-border)] px-4 py-[13px] font-sans text-sm font-light text-[var(--foreground)] placeholder:text-[var(--text-subtle)] placeholder:font-light transition-colors focus:outline-none focus:border-[var(--gold)] focus:ring-3 focus:ring-[rgba(169,125,58,0.12)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--muted)]",
          error && "border-[var(--destructive)] focus:ring-[rgba(197,54,55,0.12)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
