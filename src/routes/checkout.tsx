import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cartTotal, useCart } from "@/lib/cart";
import { getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { fbEnsureUser, fbGetProductById, fbPlaceOrder } from "@/lib/firebase-data";
import { formatInr } from "@/lib/format";
import { placeOrder } from "@/lib/server/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentMethod } from "@/lib/types";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user, isPending } = useCurrentUserState();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.displayName) {
      setName((current) => current || user.displayName || "");
    }
  }, [user]);

  if (isPending) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted">Loading checkout…</main>;
  }
  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/checkout" }} />;
  }

  const total = cartTotal(items);

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
        });
        await fbEnsureUser({
          userId: fbUser.uid,
          email: fbUser.email,
          name,
          phone,
        });
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
      const message = err instanceof Error ? err.message : "Could not place order";
      toast.error(message === "Unauthorized" ? "Please sign in again." : message);
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
          <ul className="space-y-3 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-3">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span className="tabular-nums">{formatInr(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-border pt-3 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatInr(total)}</span>
          </p>
          <Button type="submit" className="w-full" disabled={busy} size="lg">
            {busy ? "Placing order…" : "Place order"}
          </Button>
        </aside>
      </form>
    </main>
  );
}
