import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center rounded-full border border-border bg-paper",
        className,
      )}
    >
      <button
        type="button"
        className="grid size-11 place-items-center text-ink disabled:opacity-40"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </button>
      <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        className="grid size-11 place-items-center text-ink disabled:opacity-40"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
