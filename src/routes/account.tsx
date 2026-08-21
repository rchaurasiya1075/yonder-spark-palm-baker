import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatDate, formatInr } from "@/lib/format";
import { getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { fbListMyOrders } from "@/lib/firebase-data";
import { listMyOrders } from "@/lib/server/orders";
import { STATUS_LABEL, type Order } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { OrderTracker } from "@/components/order-tracker";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fbUser = getFirebaseCurrentUser();
    const load = fbUser
      ? fbListMyOrders(fbUser.uid, fbUser.email)
      : import.meta.env.VITE_GITHUB_PAGES === "1"
        ? Promise.resolve([])
        : listMyOrders();
    load
      .then((rows) => {
        if (!cancelled) setOrders(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load orders");
          setOrders([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (isPending) {
    return <main className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted">Loading account…</main>;
  }
  if (!user) return <RedirectToSignIn />;

  const payments = (orders ?? []).map((o) => ({
    id: o.id,
    date: o.createdAt,
    method: o.paymentMethod === "cod" ? "Cash on delivery" : "Online",
    status: o.paymentStatus,
    total: o.total,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        My account
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Namaste{user.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
      </h1>
      <p className="mt-2 text-sm text-muted">{user.primaryEmail}</p>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Orders</h2>
        {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
        {orders == null ? (
          <p className="mt-4 text-sm text-muted">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="mt-4 rounded-xl bg-paper p-8 ring-1 ring-border">
            <p className="text-sm text-muted">No orders yet.</p>
            <Link to="/shop" className="mt-3 inline-block text-sm font-semibold text-accent">
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl bg-paper p-5 ring-1 ring-border">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: order.id }}
                      className="font-semibold hover:underline"
                    >
                      {order.id}
                    </Link>
                    <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                  </div>
                  <Badge tone={order.orderStatus === "cancelled" ? "accent" : "forest"}>
                    {STATUS_LABEL[order.orderStatus]}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {order.items.map((i) => `${i.productName} × ${i.quantity}`).join(" · ")}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{formatInr(order.total)}</p>
                <div className="mt-4">
                  <OrderTracker status={order.orderStatus} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No payments yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl bg-paper ring-1 ring-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to="/orders/$orderId"
                        params={{ orderId: p.id }}
                        className="font-medium hover:underline"
                      >
                        {p.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(p.date)}</td>
                    <td className="px-4 py-3">{p.method}</td>
                    <td className="px-4 py-3 capitalize">{p.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInr(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
