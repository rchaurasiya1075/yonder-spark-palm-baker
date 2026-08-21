import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cartTotal, useCart } from "@/lib/cart";
import { CouponBox, useAppliedCoupon } from "@/components/coupon-box";
import { QuantityStepper } from "@/components/quantity-stepper";
import { SmartImage } from "@/components/smart-image";
import { getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { fbEnsureUser, fbGetProductById, fbPlaceOrder } from "@/lib/firebase-data";
import { fbGetShopUser } from "@/lib/firebase-users";
import { formatInr } from "@/lib/format";
import { placeOrder } from "@/lib/server/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentMethod, SavedAddress } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user, isPending } = useCurrentUserState();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const setQuantity = useCart((s) => s.setQuantity);
  const couponCode = useCart((s) => s.couponCode);
  const setCouponCode = useCart((s) => s.setCouponCode);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [busy, setBusy] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const subtotal = cartTotal(items);
  const { discount, payable } = useAppliedCoupon(subtotal);

  useEffect(() => {
    if (!user) return;
    if (user.displayName) {
      setName((current) => current || user.displayName || "");
    }
    const fbUser = getFirebaseCurrentUser();
    if (!fbUser) return;
    let cancelled = false;
    fbGetShopUser(fbUser.uid)
      .then((profile) => {
        if (cancelled || !profile) return;
        setName((current) => current || profile.name || user.displayName || "");
        setPhone((current) => current || profile.phone);
        setSavedAddresses(profile.addresses);
        const picked = profile.addresses.find((a) => a.isDefault) ?? profile.addresses[0];
        if (!picked) return;
        setPickedId(picked.id);
        setName((current) => current || picked.name || profile.name);
        setPhone((current) => current || picked.phone || profile.phone);
        setAddress((current) => current || picked.address);
        setCity((current) => current || picked.city);
        setPincode((current) => current || picked.pincode);
      })
      .catch(() => {
        /* checkout still works with a typed address */
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function applyAddress(row: SavedAddress) {
    setPickedId(row.id);
    setName(row.name || name);
    setPhone(row.phone || phone);
    setAddress(row.address);
    setCity(row.city);
    setPincode(row.pincode);
  }

  if (isPending) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted">Loading checkout…</main>;
  }
  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/checkout" }} />;
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-semibold">Nothing to checkout</h1>
        <Button asChild className="mt-6">
          <Link to="/shop">Go to shop</Link>
        </Button>
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const fbUser = getFirebaseCurrentUser();
      let order;
      if (fbUser) {
        const lines = [];
        for (const item of items) {
          const product = await fbGetProductById(item.productId);
          if (!product || !product.active) throw new Error("A product in your cart is no longer available.");
          if (product.stock < item.quantity) {
            throw new Error(`${product.name} has only ${product.stock} left.`);
          }
          lines.push({ product, quantity: item.quantity });
        }
        order = await fbPlaceOrder({
          userId: fbUser.uid,
          email: fbUser.email,
          name,
          phone,
          address,
          city,
          pincode,
          paymentMethod: payment,
          items: lines,
          couponCode,
        });
        try {
          await fbEnsureUser({
            userId: fbUser.uid,
            email: fbUser.email,
            name,
            phone,
          });
        } catch {
          /* order is already saved */
        }
      } else {
        if (import.meta.env.VITE_GITHUB_PAGES === "1") {
          throw new Error("Please sign in again.");
        }
        order = await placeOrder({
          data: {
            name,
            phone,
            address,
            city,
            pincode,
            paymentMethod: payment,
            items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          },
        });
      }
      clear();
      toast.success("Order placed");
      await navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
      const raw = err instanceof Error ? err.message : "Could not place order";
      const denied = code === "permission-denied" || /insufficient permissions/i.test(raw);
      toast.error(
        denied
          ? "Order save blocked. Sign in again, then place the order."
          : raw === "Unauthorized"
            ? "Please sign in again."
            : raw,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-semibold">Checkout</h1>
      <form onSubmit={onSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 rounded-xl bg-paper p-6 ring-1 ring-border">
          <h2 className="font-display text-xl font-semibold">Delivery details</h2>
          {savedAddresses.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
                Saved addresses
              </p>
              <div className="flex flex-wrap gap-2">
                {savedAddresses.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => applyAddress(row)}
                    className={cn(
                      "h-11 rounded-full px-4 text-sm font-semibold ring-1",
                      pickedId === row.id
                        ? "bg-ink text-paper ring-ink"
                        : "bg-cream text-ink ring-border",
                    )}
                  >
                    {row.label || "Address"}
                    {row.isDefault ? " · default" : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile</Label>
              <Input
                id="phone"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Payment</legend>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3">
              <input
                type="radio"
                name="pay"
                checked={payment === "cod"}
                onChange={() => setPayment("cod")}
              />
              <span className="text-sm">Cash on delivery (COD)</span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3">
              <input
                type="radio"
                name="pay"
                checked={payment === "online"}
                onChange={() => setPayment("online")}
              />
              <span className="text-sm">Online payment</span>
            </label>
            {payment === "online" ? (
              <p className="text-xs text-muted">
                Online orders are confirmed immediately in this shop. A payment gateway can
                be connected later.
              </p>
            ) : null}
          </fieldset>
        </div>
        <aside className="h-fit space-y-4 rounded-xl bg-paper p-6 ring-1 ring-border">
          <h2 className="font-display text-xl font-semibold">Order summary</h2>
          <ul className="space-y-4 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-md bg-cream">
                  {item.image ? (
                    <SmartImage src={item.image} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{item.name}</p>
                  <p className="text-xs text-muted">{item.unit}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <QuantityStepper
                      value={item.quantity}
                      max={item.stock}
                      onChange={(n) => setQuantity(item.productId, n)}
                    />
                    <span className="tabular-nums font-semibold">
                      {formatInr(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <CouponBox subtotal={subtotal} code={couponCode} onApply={setCouponCode} />
          <div className="space-y-1 border-t border-border pt-3 text-sm">
            <p className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatInr(subtotal)}</span>
            </p>
            {discount > 0 ? (
              <p className="flex justify-between text-forest">
                <span>Coupon {couponCode}</span>
                <span className="tabular-nums">−{formatInr(discount)}</span>
              </p>
            ) : null}
            <p className="flex justify-between font-semibold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{formatInr(payable)}</span>
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={busy} size="lg">
            {busy ? "Placing order…" : "Place order"}
          </Button>
        </aside>
      </form>
    </main>
  );
}
