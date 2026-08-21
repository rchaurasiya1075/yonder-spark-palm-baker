export type CouponType = "percent" | "fixed";

export type Coupon = {
  id: string;
  code: string;
  label: string;
  type: CouponType;
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  active: boolean;
  expiresAt: string | null;
};

export const DEFAULT_COUPONS: Coupon[] = [
  {
    id: "pinaki10",
    code: "PINAKI10",
    label: "Farm kitchen 10% off",
    type: "percent",
    value: 10,
    minOrder: 499,
    maxDiscount: 150,
    active: true,
    expiresAt: null,
  },
  {
    id: "welcome50",
    code: "WELCOME50",
    label: "Welcome ₹50 off",
    type: "fixed",
    value: 50,
    minOrder: 299,
    maxDiscount: null,
    active: true,
    expiresAt: null,
  },
  {
    id: "ghar100",
    code: "GHAR100",
    label: "₹100 off on ₹999+",
    type: "fixed",
    value: 100,
    minOrder: 999,
    maxDiscount: null,
    active: true,
    expiresAt: null,
  },
];

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function couponIsLive(coupon: Coupon, now = new Date()) {
  if (!coupon.active) return false;
  if (coupon.expiresAt) {
    const exp = new Date(coupon.expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < now.getTime()) return false;
  }
  return true;
}

export function applyCoupon(
  subtotal: number,
  coupon: Coupon,
): { ok: true; discount: number } | { ok: false; error: string } {
  if (!couponIsLive(coupon)) return { ok: false, error: "This offer is no longer active." };
  if (subtotal < coupon.minOrder) {
    return {
      ok: false,
      error: `Add items worth ₹${coupon.minOrder} to use ${coupon.code}.`,
    };
  }
  let discount =
    coupon.type === "percent"
      ? Math.round((subtotal * coupon.value) / 100)
      : Math.round(coupon.value);
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.max(0, Math.min(discount, subtotal));
  if (discount <= 0) return { ok: false, error: "Coupon cannot be applied on this cart." };
  return { ok: true, discount };
}

export function formatCouponDeal(coupon: Coupon) {
  return coupon.type === "percent" ? `${coupon.value}% off` : `₹${coupon.value} off`;
}
