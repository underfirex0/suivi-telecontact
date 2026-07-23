import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-[80px] rounded-lg border border-border bg-surface px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-3 resize-y",
          "focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-shadow",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
