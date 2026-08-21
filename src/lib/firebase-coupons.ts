import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import {
  applyCoupon,
  couponIsLive,
  DEFAULT_COUPONS,
  normalizeCouponCode,
  type Coupon,
  type CouponType,
} from "@/lib/coupons";
import { FIRESTORE_COLLECTIONS, getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";

function dbOrThrow() {
  const db = getFirebaseDb();
  if (!db) throw new Error("FIREBASE_OFF");
  return db;
}

function asStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function asNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[₹,\s]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function mapFirestoreCoupon(id: string, data: Record<string, unknown>): Coupon {
  const type: CouponType = asStr(data.type) === "fixed" ? "fixed" : "percent";
  const maxRaw = data.maxDiscount;
  return {
    id,
    code: normalizeCouponCode(asStr(data.code) || id),
    label: asStr(data.label) || asStr(data.code) || "Offer",
    type,
    value: asNum(data.value),
    minOrder: asNum(data.minOrder),
    maxDiscount:
      maxRaw == null || asStr(maxRaw) === "" ? null : asNum(maxRaw),
    active: data.active !== false,
    expiresAt: asStr(data.expiresAt) || null,
  };
}

export async function fbListCoupons(): Promise<Coupon[]> {
  if (!isFirebaseConfigured) return DEFAULT_COUPONS;
  const db = dbOrThrow();
  const snap = await getDocs(collection(db, FIRESTORE_COLLECTIONS.coupons));
  const rows = snap.docs.map((d) => mapFirestoreCoupon(d.id, d.data() as Record<string, unknown>));
  rows.sort((a, b) => a.code.localeCompare(b.code));
  return rows;
}

export async function fbListActiveCoupons(): Promise<Coupon[]> {
  try {
    if (!isFirebaseConfigured) return DEFAULT_COUPONS.filter((c) => couponIsLive(c));
    const db = dbOrThrow();
    const col = collection(db, FIRESTORE_COLLECTIONS.coupons);
    let rows: Coupon[] = [];
    try {
      const snap = await getDocs(query(col, where("active", "==", true)));
      rows = snap.docs.map((d) => mapFirestoreCoupon(d.id, d.data() as Record<string, unknown>));
    } catch {
      const snap = await getDocs(col);
      rows = snap.docs.map((d) => mapFirestoreCoupon(d.id, d.data() as Record<string, unknown>));
    }
    const live = rows.filter((c) => couponIsLive(c));
    return live.length ? live : DEFAULT_COUPONS.filter((c) => couponIsLive(c));
  } catch {
    return DEFAULT_COUPONS.filter((c) => couponIsLive(c));
  }
}

export async function fbGetCouponByCode(code: string): Promise<Coupon | null> {
  const wanted = normalizeCouponCode(code);
  if (!wanted) return null;
  const all = await fbListActiveCoupons();
  return all.find((c) => c.code === wanted) ?? null;
}

export async function fbUpsertCoupon(input: Coupon): Promise<Coupon> {
  const db = dbOrThrow();
  const code = normalizeCouponCode(input.code);
  if (code.length < 3) throw new Error("Coupon code should be at least 3 characters.");
  if (!Number.isFinite(input.value) || input.value <= 0) {
    throw new Error("Enter a discount value.");
  }
  if (input.type === "percent" && input.value > 80) {
    throw new Error("Percent off cannot be more than 80%.");
  }
  const coupon: Coupon = {
    ...input,
    id: input.id || code.toLowerCase(),
    code,
    label: input.label.trim() || code,
    value: Math.round(input.value),
    minOrder: Math.max(0, Math.round(input.minOrder || 0)),
    maxDiscount:
      input.maxDiscount == null || Number(input.maxDiscount) <= 0
        ? null
        : Math.round(Number(input.maxDiscount)),
    expiresAt: input.expiresAt?.trim() || null,
    active: Boolean(input.active),
  };
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.coupons, coupon.id), coupon, { merge: true });
  return coupon;
}

export async function fbDeleteCoupon(id: string) {
  const db = dbOrThrow();
  await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.coupons, id));
}

export async function fbEnsureDefaultCoupons() {
  try {
    if (!isFirebaseConfigured) return;
    const existing = await fbListCoupons();
    if (existing.length) return;
    const db = dbOrThrow();
    for (const coupon of DEFAULT_COUPONS) {
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.coupons, coupon.id), coupon, { merge: true });
    }
  } catch {
    /* owner may not have write yet */
  }
}

export async function resolveCouponDiscount(code: string | null | undefined, subtotal: number) {
  if (!code?.trim()) return { coupon: null as Coupon | null, discount: 0, error: null as string | null };
  const coupon = await fbGetCouponByCode(code);
  if (!coupon) return { coupon: null, discount: 0, error: "This coupon code is not valid." };
  const result = applyCoupon(subtotal, coupon);
  if (!result.ok) return { coupon, discount: 0, error: result.error };
  return { coupon, discount: result.discount, error: null };
}
