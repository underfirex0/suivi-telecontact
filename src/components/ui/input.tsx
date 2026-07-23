import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-3",
          "focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-0 focus:border-brand transition-shadow",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
