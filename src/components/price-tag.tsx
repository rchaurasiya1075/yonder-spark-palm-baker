import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PriceTag({
  price,
  mrp,
  size = "md",
}: {
  price: number;
  mrp?: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const offer = mrp != null && mrp > price;
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span
        className={cn(
          "font-semibold tabular-nums text-ink",
          size === "lg" && "text-2xl",
          size === "md" && "text-lg",
          size === "sm" && "text-base",
        )}
      >
        {formatInr(price)}
      </span>
      {offer ? (
        <>
          <span className="text-sm text-muted line-through tabular-nums">{formatInr(mrp)}</span>
          <span className="text-xs font-semibold text-forest">Offer</span>
        </>
      ) : null}
    </div>
  );
}
