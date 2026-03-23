import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 font-sans text-[10px] font-normal uppercase tracking-[2px]",
  {
    variants: {
      variant: {
        default: "bg-[var(--forest)] text-[var(--primary-foreground)]",
        gold: "bg-[var(--gold)] text-[var(--accent-foreground)]",
        muted: "bg-[var(--muted)] text-[var(--muted-foreground)]",
        outline: "border border-[var(--border)] text-[var(--muted-foreground)]",
        destructive: "bg-[var(--destructive)] text-[var(--destructive-foreground)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
