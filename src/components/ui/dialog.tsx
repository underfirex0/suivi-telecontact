"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  wide = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { wide?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[1px] animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-[calc(100vw-2.5rem)] max-h-[88vh] overflow-y-auto rounded-2xl bg-surface shadow-card-lg animate-scale-in",
          wide ? "max-w-2xl" : "max-w-lg",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-5">
      {children}
    </div>
  );
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return (
    <DialogPrimitive.Title className="font-display text-[17px] font-semibold text-ink">
      {children}
    </DialogPrimitive.Title>
  );
}

export function DialogClose({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close
      className={cn("rounded-md p-1 text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors", className)}
      aria-label="Fermer"
    >
      <X size={18} />
    </DialogPrimitive.Close>
  );
}

export function DialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2.5 border-t border-border px-6 py-4">
      {children}
    </div>
  );
}
