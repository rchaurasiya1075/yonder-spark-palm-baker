import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-md border border-border bg-paper px-3 text-sm text-ink shadow-none outline-none transition-colors placeholder:text-muted/70 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
