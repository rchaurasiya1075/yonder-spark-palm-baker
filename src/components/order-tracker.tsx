import { Check, X } from "lucide-react";
import { ORDER_FLOW, STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrderTracker({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-accent text-paper">
            <X className="size-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-ink">Order cancelled</p>
            <p className="text-sm text-muted">This order will not be shipped.</p>
          </div>
        </div>
      </div>
    );
  }

  const current = Math.max(0, ORDER_FLOW.indexOf(status));
  return (
    <ol className="grid grid-cols-5 gap-1 sm:gap-2">
      {ORDER_FLOW.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step} className="flex min-w-0 flex-col items-center gap-2 text-center">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "mx-auto grid size-8 place-items-center rounded-full text-xs font-semibold sm:size-9",
                  done ? "bg-forest text-paper" : "bg-border text-muted",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
            </div>
            <span
              className={cn(
                "text-[10px] leading-tight font-medium sm:text-xs",
                done ? "text-ink" : "text-muted",
              )}
            >
              {STATUS_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
