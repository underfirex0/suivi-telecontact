import * as React from "react";
import { cn } from "@/lib/utils";
import type { StatusColor } from "@/lib/types";

const colorClasses: Record<StatusColor, string> = {
  neutral: "bg-neutral-tint text-neutral",
  warning: "bg-warn-tint text-warn",
  danger: "bg-danger-tint text-danger",
  juridique: "bg-juridique-tint text-juridique",
  success: "bg-success-tint text-success",
};

export function Badge({
  color = "neutral",
  children,
  className,
}: {
  color?: StatusColor;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
        colorClasses[color],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ color = "neutral" }: { color?: StatusColor }) {
  const dotClasses: Record<StatusColor, string> = {
    neutral: "bg-neutral",
    warning: "bg-warn",
    danger: "bg-danger",
    juridique: "bg-juridique",
    success: "bg-success",
  };
  return <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotClasses[color])} />;
}
