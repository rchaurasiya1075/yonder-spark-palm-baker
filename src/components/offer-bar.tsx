import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { fbListActiveCoupons } from "@/lib/firebase-coupons";
import { formatCouponDeal, type Coupon } from "@/lib/coupons";

export function OfferBar() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  useEffect(() => {
    let cancelled = false;
    fbListActiveCoupons()
      .then((rows) => {
        if (!cancelled) setCoupons(rows);
      })
      .catch(() => {
        if (!cancelled) setCoupons([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!coupons.length) return null;

  return (
    <div className="border-b border-border bg-paper">
      <div className="mx-auto flex max-w-6xl items-center gap-3 overflow-x-auto px-4 py-2.5 sm:px-6">
        <Ticket className="size-4 shrink-0 text-accent" aria-hidden />
        {coupons.map((coupon) => (
          <span
            key={coupon.id}
            className="shrink-0 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold tracking-wide ring-1 ring-border"
          >
            <span className="text-accent">{coupon.code}</span>
            <span className="text-muted"> · {formatCouponDeal(coupon)}</span>
            {coupon.minOrder > 0 ? (
              <span className="text-muted"> on ₹{coupon.minOrder}+</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}
