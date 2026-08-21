import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { firebaseIdentifierSignIn, getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { fbGetProfile } from "@/lib/firebase-data";
import { isOwnerEmail } from "@/lib/firebase";
import { signOut } from "@/lib/auth/client";
import {
  loadDeskCategories,
  loadDeskOrders,
  loadDeskProducts,
  prepareDesk,
} from "@/lib/farm-desk";
import { OrdersDesk, PackingDesk, ProductsDesk } from "@/components/farm-desks";
import type { Order, Product, ShopCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/staff")({
  component: StaffPage,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function StaffAuth() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await firebaseIdentifierSignIn(identifier, password);
      if (!result.ok) setError(result.error ?? "Could not sign in.");
    } catch {
      setError("Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Farm floor</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Staff desk</h1>
      <p className="mt-2 text-sm text-muted">
        Sign in with the login the shop owner created for you. Customers cannot open this page.
      </p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="staff-id">Email</Label>
          <Input
            id="staff-id"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-password">Password</Label>
          <Input
            id="staff-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Open staff desk"}
        </Button>
      </form>
    </main>
  );
}

type Tab = "products" | "orders" | "packing";

function StaffPage() {
  const { user, isPending } = useCurrentUserState();
  const [role, setRole] = useState<"staff" | "admin" | "none" | null>(null);
  const [tab, setTab] = useState<Tab>("orders");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [ready, setReady] = useState(false);

  async function loadDesk() {
    await prepareDesk();
    const [p, o, cats] = await Promise.all([
      loadDeskProducts(),
      loadDeskOrders(),
      loadDeskCategories(),
    ]);
    setProducts(p);
    setOrders(o);
    setCategories(cats);
    setReady(true);
  }

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setRole("none");
      setReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const fbUser = getFirebaseCurrentUser();
      if (fbUser && isOwnerEmail(fbUser.email)) {
        if (!cancelled) setRole("admin");
        return;
      }
      if (!fbUser) {
        if (!cancelled) setRole("none");
        return;
      }
      try {
        const profile = await fbGetProfile(fbUser.uid);
        if (!cancelled) {
          if (profile?.role === "staff") setRole("staff");
          else if (profile?.role === "admin") setRole("admin");
          else setRole("none");
        }
      } catch {
        if (!cancelled) setRole("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isPending]);

  useEffect(() => {
    if (!user || role !== "staff") return;
    loadDesk().catch(() => toast.error("Could not open the staff desk."));
  }, [user, role]);

  if (isPending || (user && role === null)) {
    return <main className="mx-auto max-w-lg px-4 py-16 text-sm text-muted">Loading…</main>;
  }
  if (!user) return <StaffAuth />;
  if (role === "admin") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
        <h1 className="font-display text-3xl font-semibold">Owner account</h1>
        <p className="mt-3 text-sm text-muted">
          You have full access. Use the owner desk instead of the employee floor.
        </p>
        <Button asChild className="mt-8">
          <Link to="/admin">Open owner desk</Link>
        </Button>
      </main>
    );
  }
  if (role !== "staff") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
        <h1 className="font-display text-3xl font-semibold">Staff desk</h1>
        <p className="mt-3 text-sm text-muted">
          This login is not an employee account. Ask the shop owner to create one for you.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" onClick={() => void signOut("/")}>
            Sign out
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to shop</Link>
          </Button>
        </div>
      </main>
    );
  }
  if (!ready) {
    return <main className="mx-auto max-w-lg px-4 py-16 text-sm text-muted">Opening desk…</main>;
  }

  const packing = orders.filter((o) => o.orderStatus === "confirmed");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Employee</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Staff desk</h1>
      <p className="mt-2 text-sm text-muted">
        Products, packing, and order tracking. Offers and customer details stay with the owner.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["orders", "Tracking"],
            ["packing", `Packing (${packing.length})`],
            ["products", "Products"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "h-11 rounded-full bg-ink px-4 text-sm font-semibold text-paper ring-1 ring-ink"
                : "h-11 rounded-full bg-paper px-4 text-sm font-semibold text-ink ring-1 ring-border"
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "products" ? (
        <ProductsDesk
          products={products}
          categories={categories}
          onChange={async () => setProducts(await loadDeskProducts())}
        />
      ) : null}
      {tab === "orders" ? (
        <OrdersDesk orders={orders} onChange={async () => setOrders(await loadDeskOrders())} />
      ) : null}
      {tab === "packing" ? (
        <PackingDesk
          orders={packing}
          onChange={async () => setOrders(await loadDeskOrders())}
        />
      ) : null}
    </main>
  );
}
