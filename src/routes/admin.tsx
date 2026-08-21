import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { toDriveViewUrl, extractYouTubeId, normalizeVideoUrl, toVideoEmbed } from "@/lib/drive";
import { formatDate, formatDateTime, formatInr } from "@/lib/format";
import { firebaseConfig, isFirebaseConfigured, isOwnerEmail } from "@/lib/firebase";
import { firebaseEmailSignUp, firebaseIdentifierSignIn, getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { signOut } from "@/lib/auth/client";
import {
  fbEnsureUser,
  fbGetProfile,
  fbListAllOrders,
  fbListProducts,
  fbSetStock,
  fbUpdateOrderStatus,
  fbUpsertProduct,
} from "@/lib/firebase-data";
import { fbListCustomers } from "@/lib/firebase-users";
import {
  fbDeleteCoupon,
  fbEnsureDefaultCoupons,
  fbListCoupons,
  fbUpsertCoupon,
} from "@/lib/firebase-coupons";
import { formatCouponDeal, type Coupon, type CouponType } from "@/lib/coupons";
import { SmartImage } from "@/components/smart-image";
import {
  listAdminProducts,
  listAllOrders,
  saveProduct,
  setProductStock,
  updateOrderStatus,
} from "@/lib/server/admin";
import type { Category, Order, OrderStatus, Product, ProductInput, ShopUser } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
        Bookmark this page and keep the link with you. It is not shown anywhere in the
        customer shop. Only the store owner Gmail can open this desk.
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
            <Input
              id="owner-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="owner-email">{mode === "signin" ? "Email, username, or mobile" : "Gmail"}</Label>
          <Input
            id="owner-email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={mode === "signin" ? "name@gmail.com" : "owner@gmail.com"}
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

type Tab = "products" | "orders" | "packing" | "offers" | "customers";

async function loadAdminProducts() {
  if (isFirebaseConfigured) {
    try {
      return await fbListProducts({ includeHidden: true });
    } catch {
      if (import.meta.env.VITE_GITHUB_PAGES === "1") return [];
    }
  }
  if (import.meta.env.VITE_GITHUB_PAGES === "1") return [];
  return listAdminProducts();
}

async function loadAdminOrders() {
  if (isFirebaseConfigured) {
    try {
      return await fbListAllOrders();
    } catch {
      if (import.meta.env.VITE_GITHUB_PAGES === "1") return [];
    }
  }
  if (import.meta.env.VITE_GITHUB_PAGES === "1") return [];
  return listAllOrders();
}

async function persistProduct(form: ProductInput) {
  if (getFirebaseCurrentUser()) return fbUpsertProduct(form);
  if (import.meta.env.VITE_GITHUB_PAGES === "1") {
    throw new Error("Sign in with the owner account to save products.");
  }
  return saveProduct({ data: form });
}

async function persistStock(id: string, stock: number, active?: boolean) {
  if (getFirebaseCurrentUser()) {
    await fbSetStock(id, stock, active);
    return;
  }
  if (import.meta.env.VITE_GITHUB_PAGES === "1") {
    throw new Error("Sign in with the owner account to update stock.");
  }
  await setProductStock({ data: { id, stock, active } });
}

async function persistOrderStatus(orderId: string, status: OrderStatus) {
  if (getFirebaseCurrentUser()) {
    await fbUpdateOrderStatus(orderId, status);
    return;
  }
  if (import.meta.env.VITE_GITHUB_PAGES === "1") {
    throw new Error("Sign in with the owner account to update orders.");
  }
  await updateOrderStatus({ data: { orderId, status } });
}

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<ShopUser[]>([]);
  const [ready, setReady] = useState(false);

  async function loadDesk() {
    try {
      await fbEnsureDefaultCoupons();
    } catch {
      /* optional */
    }
    const [p, o, c] = await Promise.all([
      loadAdminProducts(),
      loadAdminOrders(),
      isFirebaseConfigured ? fbListCustomers().catch(() => [] as ShopUser[]) : Promise.resolve([] as ShopUser[]),
    ]);
    setProducts(p);
    setOrders(o);
    setCustomers(c);
    setReady(true);
  }

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setIsOwner(false);
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
        if (!cancelled) setIsOwner(true);
        return;
      }
      if (fbUser) {
        try {
          const profile = await fbGetProfile(fbUser.uid);
          if (!cancelled) setIsOwner(profile?.role === "admin");
        } catch {
          if (!cancelled) setIsOwner(false);
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
          This page is only for the shop owner. The customer account you are using cannot
          open it.
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
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        Owner only
      </p>
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
            ["offers", "Offers"],
            ["orders", "Orders"],
            ["packing", `Packing (${packing.length})`],
            ["customers", `Customers (${customers.filter((u) => u.role !== "admin").length})`],
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
          onChange={async () => {
            setProducts(await loadAdminProducts());
          }}
        />
      ) : null}
      {tab === "offers" ? <OffersDesk /> : null}
      {tab === "orders" ? (
        <OrdersDesk
          orders={orders}
          onChange={async () => setOrders(await loadAdminOrders())}
        />
      ) : null}
      {tab === "packing" ? (
        <PackingDesk
          orders={packing}
          onChange={async () => setOrders(await loadAdminOrders())}
        />
      ) : null}
      {tab === "customers" ? <CustomersDesk customers={customers} /> : null}
    </main>
  );
}

function emptyForm(): ProductInput {
  return {
    name: "",
    hindiName: "",
    category: "achar",
    description: "",
    price: 0,
    mrp: null,
    unit: "500 g",
    imageUrls: [],
    videoUrl: "",
    stock: 0,
    active: true,
    featured: false,
  };
}

function fromProduct(p: Product): ProductInput {
  return {
    id: p.id,
    name: p.name,
    hindiName: p.hindiName ?? "",
    category: p.category,
    description: p.description,
    price: p.price,
    mrp: p.mrp,
    unit: p.unit,
    imageUrls: p.imageUrls,
    videoUrl: p.videoUrl ?? "",
    stock: p.stock,
    active: p.active,
    featured: p.featured,
  };
}

function ProductsDesk({
  products,
  onChange,
}: {
  products: Product[];
  onChange: () => Promise<void>;
}) {
  const [form, setForm] = useState<ProductInput>(emptyForm());
  const [draftUrl, setDraftUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(form.id);
  const videoPreview = toVideoEmbed(form.videoUrl);

  function addMedia() {
    const raw = draftUrl.trim();
    if (!raw) return;
    const yt = extractYouTubeId(raw);
    if (yt) {
      setForm({ ...form, videoUrl: `https://www.youtube.com/watch?v=${yt}` });
      setDraftUrl("");
      toast.success("YouTube video attached");
      return;
    }
    const url = toDriveViewUrl(raw);
    if (!url) return;
    if (form.imageUrls.includes(url)) {
      setDraftUrl("");
      return;
    }
    setForm({ ...form, imageUrls: [...form.imageUrls, url] });
    setDraftUrl("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await persistProduct({
        ...form,
        videoUrl: normalizeVideoUrl(form.videoUrl),
      });
      toast.success(editing ? "Product updated" : "Product added");
      setForm(emptyForm());
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-3 rounded-xl bg-paper p-4 ring-1 ring-border sm:flex-row sm:items-center"
          >
            <SmartImage
              src={p.imageUrls[0]}
              alt=""
              className="size-16 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-muted">
                {p.category} · {p.unit} · {formatInr(p.price)} · stock {p.stock}
                {p.active ? "" : " · hidden"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setForm(fromProduct(p))}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await persistStock(p.id, 0);
                  toast.success("Marked out of stock");
                  await onChange();
                }}
              >
                Out of stock
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await persistStock(p.id, p.stock, !p.active);
                  toast.success(p.active ? "Hidden from shop" : "Visible in shop");
                  await onChange();
                }}
              >
                {p.active ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="h-fit space-y-3 rounded-xl bg-paper p-5 ring-1 ring-border">
        <h2 className="font-display text-xl font-semibold">
          {editing ? "Edit product" : "Add product"}
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="pname">Name</Label>
          <Input
            id="pname"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phindi">Hindi name</Label>
          <Input
            id="phindi"
            value={form.hindiName ?? ""}
            onChange={(e) => setForm({ ...form, hindiName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pcat">Category</Label>
          <select
            id="pcat"
            className="flex h-11 w-full rounded-md border border-border bg-paper px-3 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
          >
            <option value="achar">Achar</option>
            <option value="ghee">A2 Ghee</option>
            <option value="oil">Cold Pressed Oil</option>
            <option value="other">Farm produce</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pdesc">Description</Label>
          <Textarea
            id="pdesc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pprice">Selling price (₹)</Label>
            <Input
              id="pprice"
              type="number"
              min={1}
              value={form.price || ""}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pmrp">MRP / offer (₹)</Label>
            <Input
              id="pmrp"
              type="number"
              min={0}
              value={form.mrp ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  mrp: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="punit">Unit</Label>
            <Input
              id="punit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pstock">Stock</Label>
            <Input
              id="pstock"
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
            />
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Visible in shop
        </label>
        <div className="space-y-2">
          <Label>Images (Google Drive share links)</Label>
          <p className="text-xs text-muted">
            Drive file → Share → Anyone with the link. Paste the full share URL. YouTube
            links go in the video field (or paste here — they attach as video).
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://drive.google.com/file/d/…/view"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMedia();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addMedia}>
              Add
            </Button>
          </div>
          <ul className="space-y-2">
            {form.imageUrls.map((url, i) => (
              <li key={url + i} className="flex items-center gap-2">
                <SmartImage src={url} alt="" className="size-12 rounded object-cover ring-1 ring-border" />
                <span className="min-w-0 flex-1 truncate text-xs text-muted">{url}</span>
                <button
                  type="button"
                  className="text-xs font-semibold text-accent"
                  onClick={() =>
                    setForm({
                      ...form,
                      imageUrls: form.imageUrls.filter((_, idx) => idx !== i),
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pvideo">YouTube or Drive video</Label>
          <Input
            id="pvideo"
            value={form.videoUrl ?? ""}
            onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            placeholder="https://youtu.be/… or YouTube watch link"
          />
          {videoPreview ? (
            <div className="overflow-hidden rounded-md ring-1 ring-border">
              {videoPreview.kind === "file" ? (
                <video src={videoPreview.src} controls className="aspect-video w-full" />
              ) : (
                <iframe
                  title="Video preview"
                  src={videoPreview.src}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? "Saving…" : editing ? "Save changes" : "Add product"}
          </Button>
          {editing ? (
            <Button type="button" variant="ghost" onClick={() => setForm(emptyForm())}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

const NEXT: OrderStatus[] = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"];

function OrdersDesk({
  orders,
  onChange,
}: {
  orders: Order[];
  onChange: () => Promise<void>;
}) {
  return (
    <div className="mt-8 space-y-3">
      {orders.length === 0 ? (
        <p className="text-sm text-muted">No orders yet.</p>
      ) : null}
      {orders.map((order) => (
        <article key={order.id} className="rounded-xl bg-paper p-5 ring-1 ring-border">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                to="/orders/$orderId"
                params={{ orderId: order.id }}
                className="font-semibold hover:underline"
              >
                {order.id}
              </Link>
              <p className="text-xs text-muted">{formatDateTime(order.createdAt)}</p>
              <p className="mt-1 text-sm">
                {order.customerName} · {order.phone} · {order.city}
              </p>
              <p className="text-sm text-muted">
                {order.items.map((i) => `${i.productName} × ${i.quantity}`).join(" · ")}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">{formatInr(order.total)}</p>
              <Badge tone={order.orderStatus === "cancelled" ? "accent" : "forest"}>
                {STATUS_LABEL[order.orderStatus]}
              </Badge>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {NEXT.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={order.orderStatus === status ? "default" : "outline"}
                disabled={order.orderStatus === "cancelled" && status !== "cancelled"}
                onClick={async () => {
                  try {
                    await persistOrderStatus(order.id, status);
                    toast.success(`Marked ${STATUS_LABEL[status]}`);
                    await onChange();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Update failed");
                  }
                }}
              >
                {STATUS_LABEL[status]}
              </Button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function PackingDesk({
  orders,
  onChange,
}: {
  orders: Order[];
  onChange: () => Promise<void>;
}) {
  return (
    <div className="mt-8">
      <p className="text-sm text-muted">
        Confirmed orders waiting to be packed. Mark packed to clear them from this desk.
      </p>
      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Packing desk is clear.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-col gap-3 rounded-xl bg-paper p-5 ring-1 ring-border sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{order.id}</p>
                <p className="text-sm text-muted">
                  {order.customerName} · {order.city} · {order.pincode}
                </p>
                <p className="text-sm">
                  {order.items.map((i) => `${i.productName} × ${i.quantity}`).join(" · ")}
                </p>
              </div>
              <Button
                onClick={async () => {
                  await persistOrderStatus(order.id, "packed");
                  toast.success("Packed and cleared from desk");
                  await onChange();
                }}
              >
                Packed — clear
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
      const rows = await fbListCoupons();
      setCoupons(rows);
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
      const saved = await fbUpsertCoupon({
        ...form,
        id: form.id || "",
      });
      toast.success(form.id ? "Offer updated" : "Offer added");
      setForm(emptyCoupon());
      await refresh();
      void saved;
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
          <p className="text-sm text-muted">
            No offers in Firebase yet. Add PINAKI10 or another code on the right.
          </p>
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
        <h2 className="font-display text-xl font-semibold">
          {form.id ? "Edit offer" : "New coupon"}
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="ccode">Code</Label>
          <Input
            id="ccode"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="PINAKI10"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clabel">Offer line</Label>
          <Input
            id="clabel"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Festival 10% off"
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
  const shoppers = customers.filter((u) => u.role !== "admin");
  const owners = customers.filter((u) => u.role === "admin");

  return (
    <section className="mt-8 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-paper p-5 ring-1 ring-border">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Total accounts</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{customers.length}</p>
        </div>
        <div className="rounded-xl bg-paper p-5 ring-1 ring-border">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Customers</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{shoppers.length}</p>
        </div>
        <div className="rounded-xl bg-paper p-5 ring-1 ring-border">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Owner / admin</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{owners.length}</p>
        </div>
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
                <Badge tone={person.role === "admin" ? "accent" : "forest"}>
                  {person.role === "admin" ? "Admin" : "Customer"}
                </Badge>
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


