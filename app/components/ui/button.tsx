import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-[10.88px] font-normal uppercase tracking-[2.18px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--gold)] text-[var(--accent-foreground)] rounded-[var(--radius-sm)] hover:brightness-108 hover:-translate-y-px active:translate-y-0 active:brightness-95",
        outline:
          "bg-transparent border border-[var(--text-border)] text-[var(--text-body)] rounded-[var(--radius-sm)] hover:border-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        goldDark:
          "bg-[rgba(201,168,76,0.4)] text-[var(--text-dark-nav)] rounded-[var(--radius-sm)] hover:bg-[rgba(201,168,76,0.5)]",
        destructive:
          "bg-[var(--destructive)] text-[var(--destructive-foreground)] rounded-[var(--radius-sm)] hover:brightness-110",
        ghost:
          "bg-transparent text-[var(--text-body)] hover:bg-[var(--input-bg)]",
      },
      size: {
        default: "px-11 py-[15px]",
        sm: "px-6 py-2.5 text-[10px]",
        lg: "px-14 py-5",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
