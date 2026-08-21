import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatDate } from "@/lib/format";
import { firebaseConfig, isFirebaseConfigured, isOwnerEmail } from "@/lib/firebase";
import { firebaseEmailSignUp, firebaseIdentifierSignIn, getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { signOut } from "@/lib/auth/client";
import { fbEnsureUser, fbGetProfile } from "@/lib/firebase-data";
import { fbCreateStaffAccount } from "@/lib/firebase-staff";
import { fbUpsertCategory } from "@/lib/firebase-categories";
import {
  loadDeskCategories,
  loadDeskCustomers,
  loadDeskOrders,
  loadDeskProducts,
  prepareDesk,
} from "@/lib/farm-desk";
import { OrdersDesk, PackingDesk, ProductsDesk } from "@/components/farm-desks";
import {
  fbDeleteCoupon,
  fbListCoupons,
  fbUpsertCoupon,
} from "@/lib/firebase-coupons";
import { formatCouponDeal, type Coupon, type CouponType } from "@/lib/coupons";
import type { Order, Product, ShopCategory, ShopUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function OwnerAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        const result = await firebaseIdentifierSignIn(email, password);
        if (!result.ok) {
          setError(result.error ?? "Could not sign in.");
        }
        return;
      }
      if (password.length < 10) {
        setError("Owner password should be at least 10 characters.");
        return;
      }
      if (!isOwnerEmail(email)) {
        setError("Use the store owner Gmail for this desk.");
        return;
      }
      const result = await firebaseEmailSignUp(email, password, name, { role: "admin" });
      if (!result.ok) {
        setError(result.error ?? "Could not create owner account.");
      }
    } catch {
      setError(mode === "signin" ? "Could not sign in." : "Could not create owner account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Store owner</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Owner desk</h1>
      <p className="mt-2 text-sm text-muted">
        Bookmark this page. Employees use a separate desk link that only you create accounts
        for.
      </p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
          }}
          className={cn(
            "h-11 rounded-full px-4 text-sm font-semibold ring-1",
            mode === "signin" ? "bg-ink text-paper ring-ink" : "bg-cream text-ink ring-border",
          )}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={cn(
            "h-11 rounded-full px-4 text-sm font-semibold ring-1",
            mode === "signup" ? "bg-ink text-paper ring-ink" : "bg-cream text-ink ring-border",
          )}
        >
          Create account
        </button>
      </div>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {mode === "signup" ? (
          <div className="space-y-1.5">
            <Label htmlFor="owner-name">Your name</Label>
            <Input id="owner-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="owner-email">{mode === "signin" ? "Email, username, or mobile" : "Gmail"}</Label>
          <Input
            id="owner-email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="owner-password">Password</Label>
          <Input
            id="owner-password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Open desk" : "Create owner account"}
        </Button>
      </form>
    </main>
  );
}

type Tab = "products" | "orders" | "packing" | "offers" | "customers" | "team" | "categories";

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [isStaffUser, setIsStaffUser] = useState(false);
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<ShopUser[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [ready, setReady] = useState(false);

  async function loadDesk() {
    await prepareDesk();
    const [p, o, c, cats] = await Promise.all([
      loadDeskProducts(),
      loadDeskOrders(),
      loadDeskCustomers(),
      loadDeskCategories(),
    ]);
    setProducts(p);
    setOrders(o);
    setCustomers(c);
    setCategories(cats);
    setReady(true);
  }

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setIsOwner(false);
      setIsStaffUser(false);
      setReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const fbUser = getFirebaseCurrentUser();
      if (fbUser && isOwnerEmail(fbUser.email)) {
        try {
          await fbEnsureUser({
            userId: fbUser.uid,
            email: fbUser.email,
            name: fbUser.displayName,
            role: "admin",
          });
        } catch {
          /* owner email is admin in Firestore rules */
        }
        if (!cancelled) {
          setIsOwner(true);
          setIsStaffUser(false);
        }
        return;
      }
      if (fbUser) {
        try {
          const profile = await fbGetProfile(fbUser.uid);
          if (!cancelled) {
            setIsOwner(profile?.role === "admin");
            setIsStaffUser(profile?.role === "staff");
          }
        } catch {
          if (!cancelled) {
            setIsOwner(false);
            setIsStaffUser(false);
          }
        }
        return;
      }
      if (!cancelled) setIsOwner(import.meta.env.VITE_GITHUB_PAGES !== "1");
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isPending]);

  useEffect(() => {
    if (!user || isOwner !== true) return;
    loadDesk().catch(() => {
      toast.error("Could not open the owner desk.");
    });
  }, [user, isOwner]);

  if (isPending || (user && isOwner === null)) {
    return <main className="mx-auto max-w-lg px-4 py-16 text-sm text-muted">Loading…</main>;
  }
  if (!user) {
    return <OwnerAuth />;
  }
  if (!isOwner) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Store owner</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Owner desk</h1>
        <p className="mt-3 text-sm text-muted">
          {isStaffUser
            ? "This page is for the shop owner. Employees use the staff desk."
            : "This page is only for the shop owner. The customer account you are using cannot open it."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {isStaffUser ? (
            <Button asChild>
              <Link to="/staff">Open staff desk</Link>
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => void signOut("/")}>
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
  const staffCount = customers.filter((u) => u.role === "staff").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Owner only</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Farm desk</h1>
      <p className="mt-2 text-xs text-muted">
        {isFirebaseConfigured
          ? `Catalog and orders sync to Firebase · ${firebaseConfig.projectId}`
          : "Local catalog (Firebase env not set)"}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["products", "Products"],
            ["categories", "Categories"],
            ["offers", "Offers"],
            ["orders", "Orders"],
            ["packing", `Packing (${packing.length})`],
            ["customers", `Customers (${customers.filter((u) => u.role === "customer").length})`],
            ["team", `Team (${staffCount})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "h-11 rounded-full px-4 text-sm font-semibold ring-1",
              tab === id ? "bg-ink text-paper ring-ink" : "bg-paper text-ink ring-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "products" ? (
        <ProductsDesk
          products={products}
          categories={categories}
          onChange={async () => {
            setProducts(await loadDeskProducts());
          }}
        />
      ) : null}
      {tab === "categories" ? (
        <CategoriesDesk
          categories={categories}
          onChange={async () => setCategories(await loadDeskCategories())}
        />
      ) : null}
      {tab === "offers" ? <OffersDesk /> : null}
      {tab === "orders" ? (
        <OrdersDesk orders={orders} onChange={async () => setOrders(await loadDeskOrders())} />
      ) : null}
      {tab === "packing" ? (
        <PackingDesk
          orders={packing}
          onChange={async () => setOrders(await loadDeskOrders())}
        />
      ) : null}
      {tab === "customers" ? (
        <CustomersDesk customers={customers.filter((u) => u.role === "customer")} />
      ) : null}
      {tab === "team" ? (
        <TeamDesk
          staff={customers.filter((u) => u.role === "staff")}
          onChange={async () => setCustomers(await loadDeskCustomers())}
        />
      ) : null}
    </main>
  );
}

function emptyCoupon(): Coupon {
  return {
    id: "",
    code: "",
    label: "",
    type: "percent",
    value: 10,
    minOrder: 0,
    maxDiscount: null,
    active: true,
    expiresAt: null,
  };
}

function OffersDesk() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<Coupon>(emptyCoupon());
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setCoupons(await fbListCoupons());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load offers");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fbUpsertCoupon({ ...form, id: form.id || "" });
      toast.success(form.id ? "Offer updated" : "Offer added");
      setForm(emptyCoupon());
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save offer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        {coupons.length === 0 ? (
          <p className="text-sm text-muted">No offers in Firebase yet.</p>
        ) : null}
        {coupons.map((coupon) => (
          <div
            key={coupon.id}
            className="flex flex-col gap-3 rounded-xl bg-paper p-4 ring-1 ring-border sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold tracking-wide">{coupon.code}</p>
              <p className="text-xs text-muted">
                {coupon.label} · {formatCouponDeal(coupon)}
                {coupon.minOrder ? ` · min ₹${coupon.minOrder}` : ""}
                {coupon.active ? "" : " · paused"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setForm(coupon)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await fbUpsertCoupon({ ...coupon, active: !coupon.active });
                  await refresh();
                }}
              >
                {coupon.active ? "Pause" : "Activate"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await fbDeleteCoupon(coupon.id);
                  toast.success("Offer removed");
                  await refresh();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="h-fit space-y-3 rounded-xl bg-paper p-5 ring-1 ring-border">
        <h2 className="font-display text-xl font-semibold">{form.id ? "Edit offer" : "New coupon"}</h2>
        <div className="space-y-1.5">
          <Label htmlFor="ccode">Code</Label>
          <Input
            id="ccode"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clabel">Offer line</Label>
          <Input
            id="clabel"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ctype">Type</Label>
            <select
              id="ctype"
              className="flex h-11 w-full rounded-md border border-border bg-paper px-3 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}
            >
              <option value="percent">Percent %</option>
              <option value="fixed">Fixed ₹</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cval">Value</Label>
            <Input
              id="cval"
              type="number"
              min={1}
              value={form.value || ""}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cmin">Min order ₹</Label>
            <Input
              id="cmin"
              type="number"
              min={0}
              value={form.minOrder}
              onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cmax">Max ₹ off</Label>
            <Input
              id="cmax"
              type="number"
              min={0}
              value={form.maxDiscount ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxDiscount: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Active on shop
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? "Saving…" : form.id ? "Save offer" : "Add coupon"}
          </Button>
          {form.id ? (
            <Button type="button" variant="ghost" onClick={() => setForm(emptyCoupon())}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function CustomersDesk({ customers }: { customers: ShopUser[] }) {
  return (
    <section className="mt-8 space-y-4">
      <div className="rounded-xl bg-paper p-5 ring-1 ring-border">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Customers</p>
        <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{customers.length}</p>
      </div>
      {customers.length === 0 ? (
        <p className="text-sm text-muted">No customer accounts in Firebase yet.</p>
      ) : (
        <ul className="space-y-3">
          {customers.map((person) => (
            <li key={person.userId} className="rounded-xl bg-paper p-5 ring-1 ring-border">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {person.name || "Unnamed"}
                    {person.username ? (
                      <span className="ml-2 text-sm font-medium text-muted">@{person.username}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {person.email}
                    {person.phone ? ` · ${person.phone}` : ""}
                  </p>
                  <p className="text-xs text-muted">Joined {formatDate(person.createdAt)}</p>
                </div>
                <Badge tone="forest">Customer</Badge>
              </div>
              {person.addresses.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {person.addresses.map((addr) => (
                    <li key={addr.id}>
                      {addr.label}: {addr.address}, {addr.city} {addr.pincode}
                      {addr.isDefault ? " · default" : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-muted">No saved addresses</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TeamDesk({
  staff,
  onChange,
}: {
  staff: ShopUser[];
  onChange: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fbCreateStaffAccount({ name, email, password });
      toast.success("Employee account created. Share the staff desk link and this login.");
      setName("");
      setEmail("");
      setPassword("");
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create employee");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Employees can list products, update stock, pack orders, and move tracking. They cannot
          see customers, coupons, or this team tab.
        </p>
        {staff.length === 0 ? (
          <p className="text-sm text-muted">No employees yet.</p>
        ) : (
          staff.map((person) => (
            <div key={person.userId} className="rounded-xl bg-paper p-5 ring-1 ring-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{person.name || "Employee"}</p>
                  <p className="text-sm text-muted">{person.email}</p>
                </div>
                <Badge>Staff</Badge>
              </div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={submit} className="h-fit space-y-3 rounded-xl bg-paper p-5 ring-1 ring-border">
        <h2 className="font-display text-xl font-semibold">Add employee</h2>
        <p className="text-xs text-muted">
          They sign in at the staff desk. Do not share the owner desk link.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="staff-name">Name</Label>
          <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-email">Gmail</Label>
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-pass">Password</Label>
          <Input
            id="staff-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create staff login"}
        </Button>
      </form>
    </section>
  );
}

function CategoriesDesk({
  categories,
  onChange,
}: {
  categories: ShopCategory[];
  onChange: () => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [hindi, setHindi] = useState("");
  const [blurb, setBlurb] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fbUpsertCategory({ label, hindi, blurb, sort: categories.length + 1 });
      toast.success(`${label} added to the pantry`);
      setLabel("");
      setHindi("");
      setBlurb("");
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add category");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-xl bg-paper p-5 ring-1 ring-border">
            <p className="text-xs text-muted">{cat.hindi || cat.id}</p>
            <p className="font-display text-xl font-semibold">{cat.label}</p>
            {cat.blurb ? <p className="mt-1 text-sm text-muted">{cat.blurb}</p> : null}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="h-fit space-y-3 rounded-xl bg-paper p-5 ring-1 ring-border">
        <h2 className="font-display text-xl font-semibold">New category</h2>
        <p className="text-xs text-muted">
          Add honey, papad, spice mix — anything. It appears on the shop as soon as you save.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="cat-label">Name</Label>
          <Input
            id="cat-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Honey"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat-hindi">Hindi (optional)</Label>
          <Input id="cat-hindi" value={hindi} onChange={(e) => setHindi(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat-blurb">Short line</Label>
          <Input
            id="cat-blurb"
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="Raw farm honey from our hives."
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Add category"}
        </Button>
      </form>
    </section>
  );
}
