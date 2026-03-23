import * as React from "react";
import { cn } from "~/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-[var(--radius-lg)] border border-[var(--text-border)] bg-[var(--glass-white)] p-8", className)} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (<div ref={ref} className={cn("flex flex-col gap-1.5 pb-6", className)} {...props} />)
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (<div ref={ref} className={cn("font-serif text-[28px] font-normal leading-[1.3] text-[var(--foreground)]", className)} {...props} />)
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (<div ref={ref} className={cn("font-sans text-sm font-light leading-[1.7] text-[var(--text-caption)]", className)} {...props} />)
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (<div ref={ref} className={cn("", className)} {...props} />)
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (<div ref={ref} className={cn("flex items-center pt-6", className)} {...props} />)
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
