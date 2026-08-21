import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatDateTime, formatInr } from "@/lib/format";
import { getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { fbGetOrder, fbListMyOrders } from "@/lib/firebase-data";
import { getMyOrder } from "@/lib/server/orders";
import { STATUS_LABEL, type Order } from "@/lib/types";
import { OrderTracker } from "@/components/order-tracker";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/orders/$orderId")({
  component: OrderPage,
});

function OrderPage() {
  const { orderId } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fbUser = getFirebaseCurrentUser();
    const load = fbUser
      ? fbGetOrder(orderId).then(async (row) => {
          if (row) return row;
          const mine = await fbListMyOrders(fbUser.uid, fbUser.email);
          return mine.find((o) => o.id === orderId) ?? null;
        })
      : getMyOrder({ data: { orderId } });
    load
      .then((row) => {
        if (!cancelled) setOrder(row);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, orderId]);

  if (isPending) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted">Loading order…</main>;
  }
  if (!user) return <RedirectToSignIn />;
  if (order === undefined) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted">Loading order…</main>;
  }
  if (!order) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-3xl font-semibold">Order not found</h1>
        <Link to="/account" className="mt-4 inline-block text-sm font-semibold text-accent">
          Back to account
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs text-muted">
        <Link to="/account" className="hover:underline">
          My account
        </Link>
        <span className="px-2">/</span>
        {order.id}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-semibold">{order.id}</h1>
        <Badge tone={order.orderStatus === "cancelled" ? "accent" : "forest"}>
          {STATUS_LABEL[order.orderStatus]}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted">Placed {formatDateTime(order.createdAt)}</p>

      <section className="mt-8 rounded-xl bg-paper p-6 ring-1 ring-border">
        <h2 className="font-display text-xl font-semibold">Tracking</h2>
        <div className="mt-5">
          <OrderTracker status={order.orderStatus} />
        </div>
        <ol className="mt-6 space-y-2 text-sm">
          {order.events.map((ev) => (
            <li key={ev.id} className="flex justify-between gap-4 text-muted">
              <span>
                {STATUS_LABEL[ev.status]}
                {ev.note ? ` · ${ev.note}` : ""}
              </span>
              <span className="shrink-0">{formatDateTime(ev.createdAt)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 rounded-xl bg-paper p-6 ring-1 ring-border">
        <h2 className="font-display text-xl font-semibold">Items</h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="size-14 rounded-md object-cover"
                />
              ) : (
                <div className="size-14 rounded-md bg-cream" />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  to="/product/$slug"
                  params={{ slug: item.productSlug }}
                  className="font-medium hover:underline"
                >
                  {item.productName}
                </Link>
                <p className="text-xs text-muted">
                  {item.unit} · × {item.quantity}
                </p>
              </div>
              <span className="text-sm tabular-nums">
                {formatInr(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between border-t border-border pt-3 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatInr(order.total)}</span>
        </p>
      </section>

      <section className="mt-6 rounded-xl bg-paper p-6 ring-1 ring-border">
        <h2 className="font-display text-xl font-semibold">Delivery</h2>
        <p className="mt-2 text-sm">
          {order.customerName}
          <br />
          {order.address}
          <br />
          {order.city} — {order.pincode}
          <br />
          {order.phone}
        </p>
        <p className="mt-3 text-sm text-muted">
          Payment: {order.paymentMethod === "cod" ? "Cash on delivery" : "Online"} ·{" "}
          {order.paymentStatus}
        </p>
      </section>
    </main>
  );
}
