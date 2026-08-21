import { useEffect, useState } from "react";
import { applyCoupon, normalizeCouponCode, type Coupon } from "@/lib/coupons";
import { useCart } from "@/lib/cart";
import { fbListActiveCoupons, resolveCouponDiscount } from "@/lib/firebase-coupons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function useAppliedCoupon(subtotal: number) {
  const couponCode = useCart((s) => s.couponCode);
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!couponCode) {
      setDiscount(0);
      return;
    }
    resolveCouponDiscount(couponCode, subtotal).then((result) => {
      if (!cancelled) setDiscount(result.discount);
    });
    return () => {
      cancelled = true;
    };
  }, [couponCode, subtotal]);

  return {
    couponCode,
    discount,
    payable: Math.max(0, subtotal - discount),
  };
}

export function CouponBox({
  subtotal,
  code,
  onApply,
}: {
  subtotal: number;
  code: string | null;
  onApply: (code: string | null) => void;
}) {
  const [draft, setDraft] = useState(code ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<Coupon | null>(null);

  async function check(raw: string) {
    const wanted = normalizeCouponCode(raw);
    if (!wanted) {
      setApplied(null);
      setError(null);
      onApply(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const coupons = await fbListActiveCoupons();
      const coupon = coupons.find((c) => c.code === wanted) ?? null;
      if (!coupon) {
        setApplied(null);
        onApply(null);
        setError("This coupon code is not valid.");
        return;
      }
      const result = applyCoupon(subtotal, coupon);
      if (!result.ok) {
        setApplied(null);
        onApply(null);
        setError(result.error);
        return;
      }
      setApplied(coupon);
      onApply(coupon.code);
    } catch {
      setError("Could not check coupon right now.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (code) void check(code);
    // hydrate once from stored code
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Coupon code</p>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          placeholder="PINAKI10"
          aria-label="Coupon code"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void check(draft);
            }
          }}
        />
        <Button type="button" variant="outline" onClick={() => void check(draft)} disabled={busy}>
          {busy ? "…" : "Apply"}
        </Button>
      </div>
      {error ? <p className="text-xs text-accent">{error}</p> : null}
      {applied && code ? (
        <p className="text-xs text-forest">
          {applied.code} applied — {applied.label}.{" "}
          <button
            type="button"
            className="font-semibold underline-offset-2 hover:underline"
            onClick={() => {
              setDraft("");
              setApplied(null);
              setError(null);
              onApply(null);
            }}
          >
            Remove
          </button>
        </p>
      ) : (
        <p className="text-xs text-muted">Try PINAKI10, WELCOME50, or GHAR100.</p>
      )}
    </div>
  );
}
