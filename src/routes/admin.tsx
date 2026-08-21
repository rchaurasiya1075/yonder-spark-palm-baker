import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { toDriveViewUrl } from "@/lib/drive";
import { formatDateTime, formatInr } from "@/lib/format";
import {
  listAdminProducts,
  listAllOrders,
  saveProduct,
  setProductStock,
  unlockAdminDesk,
  updateOrderStatus,
} from "@/lib/server/admin";
import type { Category, Order, OrderStatus, Product, ProductInput } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const UNLOCK_KEY = "pinaki-owner-desk";

type Tab = "products" | "orders" | "packing";

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUnlocked(sessionStorage.getItem(UNLOCK_KEY) === "1");
  }, []);

  async function loadDesk() {
    const [p, o] = await Promise.all([listAdminProducts(), listAllOrders()]);
    setProducts(p);
    setOrders(o);
    setReady(true);
  }

  useEffect(() => {
    if (!user || !unlocked) return;
    loadDesk().catch(() => {
      setUnlocked(false);
      sessionStorage.removeItem(UNLOCK_KEY);
    });
  }, [user, unlocked]);

  if (isPending) {
    return <main className="mx-auto max-w-lg px-4 py-16 text-sm text-muted">Loading…</main>;
  }
  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/admin" }} />;
  }

  if (!unlocked) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          Store owner
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Owner desk</h1>
        <p className="mt-2 text-sm text-muted">
          Signed in as {user.primaryEmail ?? user.displayName}. Enter the owner PIN to
          continue. Customers cannot open this desk.
        </p>
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setPinError(null);
            try {
              await unlockAdminDesk({ data: pin });
              sessionStorage.setItem(UNLOCK_KEY, "1");
              setUnlocked(true);
            } catch (err) {
              setPinError(err instanceof Error ? err.message : "PIN rejected");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pin">Owner PIN</Label>
            <Input
              id="pin"
              type="password"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>
          {pinError ? <p className="text-sm text-accent">{pinError}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Checking…" : "Open desk"}
          </Button>
        </form>
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
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["products", "Products"],
            ["orders", "Orders"],
            ["packing", `Packing (${packing.length})`],
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
            setProducts(await listAdminProducts());
          }}
        />
      ) : null}
      {tab === "orders" ? (
        <OrdersDesk
          orders={orders}
          onChange={async () => setOrders(await listAllOrders())}
        />
      ) : null}
      {tab === "packing" ? (
        <PackingDesk
          orders={packing}
          onChange={async () => setOrders(await listAllOrders())}
        />
      ) : null}
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveProduct({ data: form });
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
            <img
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
                  await setProductStock({ data: { id: p.id, stock: 0 } });
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
                  await setProductStock({
                    data: { id: p.id, stock: p.stock, active: !p.active },
                  });
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
            Paste a Drive link shared as “Anyone with the link”. Multiple images supported.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://drive.google.com/file/d/…/view"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const url = toDriveViewUrl(draftUrl);
                if (!url) return;
                setForm({ ...form, imageUrls: [...form.imageUrls, url] });
                setDraftUrl("");
              }}
            >
              Add
            </Button>
          </div>
          <ul className="space-y-2">
            {form.imageUrls.map((url, i) => (
              <li key={url + i} className="flex items-center gap-2">
                <img src={url} alt="" className="size-12 rounded object-cover ring-1 ring-border" />
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
          <Label htmlFor="pvideo">Video URL (YouTube or mp4)</Label>
          <Input
            id="pvideo"
            value={form.videoUrl ?? ""}
            onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=…"
          />
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
                    await updateOrderStatus({ data: { orderId: order.id, status } });
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
                  await updateOrderStatus({
                    data: { orderId: order.id, status: "packed" },
                  });
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
