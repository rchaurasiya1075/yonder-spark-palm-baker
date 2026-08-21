import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { toDriveViewUrl, extractYouTubeId, normalizeVideoUrl } from "@/lib/drive";
import { formatDateTime, formatInr } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import {
  emptyProductForm,
  formFromProduct,
  persistOrderStatus,
  persistProduct,
  persistStock,
} from "@/lib/farm-desk";
import { FarmVideo } from "@/components/farm-video";
import { SmartImage } from "@/components/smart-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Order, OrderStatus, Product, ProductInput, ShopCategory } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

const NEXT: OrderStatus[] = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"];

export function ProductsDesk({
  products,
  categories,
  onChange,
  stockOnly = false,
}: {
  products: Product[];
  categories: ShopCategory[];
  onChange: () => Promise<void>;
  stockOnly?: boolean;
}) {
  const fallbackCat = categories[0]?.id ?? "achar";
  const [form, setForm] = useState<ProductInput>(emptyProductForm(fallbackCat));
  const [draftUrl, setDraftUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(form.id);

  function addMedia() {
    const raw = draftUrl.trim();
    if (!raw) return;
    const yt = extractYouTubeId(raw);
    if (yt) {
      setForm({ ...form, videoUrl: `https://www.youtube.com/watch?v=${yt}` });
      setDraftUrl("");
      toast.success("Video attached");
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
      setForm(emptyProductForm(fallbackCat));
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const catOptions = [...categories];
  if (form.category && !catOptions.some((c) => c.id === form.category)) {
    catOptions.push({
      id: form.category,
      label: categoryLabel(form.category),
      hindi: "",
      blurb: "",
      sort: 99,
      active: true,
    });
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-3 rounded-xl bg-paper p-4 ring-1 ring-border sm:flex-row sm:items-center"
          >
            <SmartImage src={p.imageUrls[0]} alt="" className="size-16 rounded-md object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-muted">
                {categoryLabel(p.category, categories)} · {p.unit} · {formatInr(p.price)} · stock {p.stock}
                {p.active ? "" : " · hidden"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stockOnly ? (
                <Button size="sm" variant="outline" onClick={() => setForm(formFromProduct(p))}>
                  Stock
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setForm(formFromProduct(p))}>
                  Edit
                </Button>
              )}
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
      {stockOnly ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!form.id) return;
            setBusy(true);
            try {
              await persistStock(form.id, form.stock, form.active);
              toast.success("Stock updated");
              setForm(emptyProductForm(fallbackCat));
              await onChange();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not update stock");
            } finally {
              setBusy(false);
            }
          }}
          className="h-fit space-y-3 rounded-xl bg-paper p-5 ring-1 ring-border"
        >
          <h2 className="font-display text-xl font-semibold">Update stock</h2>
          <p className="text-sm text-muted">{form.id ? form.name : "Pick a product, then set the jar count."}</p>
          <div className="space-y-1.5">
            <Label htmlFor="pstock">Stock</Label>
            <Input
              id="pstock"
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
              disabled={!form.id}
            />
          </div>
          <Button type="submit" disabled={busy || !form.id} className="w-full">
            {busy ? "Saving…" : "Save stock"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submit} className="h-fit space-y-3 rounded-xl bg-paper p-5 ring-1 ring-border">
          <h2 className="font-display text-xl font-semibold">{editing ? "Edit product" : "Add product"}</h2>
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
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {catOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
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
              <Label htmlFor="pstock2">Stock</Label>
              <Input
                id="pstock2"
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
              Drive file → Share → Anyone with the link. Paste the full share URL.
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
            <Label htmlFor="pvideo">Product video (YouTube or Drive)</Label>
            <Input
              id="pvideo"
              value={form.videoUrl ?? ""}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              placeholder="YouTube or Drive video link"
            />
            {form.videoUrl ? (
              <div className="overflow-hidden rounded-md ring-1 ring-border">
                <FarmVideo url={form.videoUrl} name={form.name || "Product"} />
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1">
              {busy ? "Saving…" : editing ? "Save changes" : "Add product"}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={() => setForm(emptyProductForm(fallbackCat))}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}

export function OrdersDesk({
  orders,
  onChange,
}: {
  orders: Order[];
  onChange: () => Promise<void>;
}) {
  return (
    <div className="mt-8 space-y-3">
      {orders.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : null}
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

export function PackingDesk({
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
