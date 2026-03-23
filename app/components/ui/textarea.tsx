import * as React from "react";
import { cn } from "~/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[100px] w-full rounded-[var(--radius-sm)] bg-[var(--input-bg)] border border-[var(--input-border)] px-4 py-[13px] font-sans text-sm font-light text-[var(--foreground)] placeholder:text-[var(--text-subtle)] placeholder:font-light transition-colors focus:outline-none focus:border-[var(--gold)] focus:ring-3 focus:ring-[rgba(169,125,58,0.12)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--muted)]",
          error && "border-[var(--destructive)] focus:ring-[rgba(197,54,55,0.12)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
