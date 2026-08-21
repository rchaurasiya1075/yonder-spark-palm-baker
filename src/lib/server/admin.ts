import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { normalizeImageUrls, toDriveViewUrl } from "@/lib/drive";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  fbEnsureUser,
  fbListAllOrders,
  fbListProducts,
  fbSetStock,
  fbUpdateOrderStatus,
  fbUpsertProduct,
} from "@/lib/firebase-data";
import type { Order, OrderStatus, ProductInput } from "@/lib/types";
import { makeId, slugify } from "@/lib/utils";
import {
  mapOrder,
  mapOrderEvent,
  mapOrderItem,
  mapProduct,
  type OrderEventRow,
  type OrderItemRow,
  type OrderRow,
  type ProductRow,
} from "./map";

const OWNER_PIN = "PINAKI";

const SELECT_PRODUCT = `
  id, slug, name, hindi_name, category, description, price, mrp, unit,
  image_urls, video_url, stock, active, featured, created_at, updated_at
`;

async function requireAdmin(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ role: string }>(
    `select role from profiles where user_id = $1`,
    [userId],
  );
  if (rows[0]?.role !== "admin") {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

export const unlockAdminDesk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((pin: string) => pin)
  .handler(async ({ context, data: pin }) => {
    if (pin.trim() !== OWNER_PIN) {
      throw new Error("That PIN does not match. Try again.");
    }
    const sql = await getSql();
    await sql.query(
      `insert into profiles (user_id, role) values ($1, 'admin')
       on conflict (user_id) do update set role = 'admin'`,
      [context.userId],
    );
    if (isFirebaseConfigured) {
      try {
        await fbEnsureUser({
          userId: context.userId,
          email: context.email,
          role: "admin",
        });
      } catch {
        /* optional */
      }
    }
    return { role: "admin" as const };
  });

export const listAdminProducts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    if (isFirebaseConfigured) {
      try {
        const products = await fbListProducts({ includeHidden: true });
        if (products.length) return products;
      } catch {
        /* fall through */
      }
    }
    const sql = await getSql();
    const rows = await sql.query<ProductRow>(
      `select ${SELECT_PRODUCT} from products order by category asc, name asc`,
    );
    return rows.map(mapProduct);
  });

function validateProduct(input: ProductInput): ProductInput {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Product name is required.");
  const description = input.description.trim();
  if (description.length < 8) throw new Error("Please add a product description.");
  const unit = input.unit.trim();
  if (!unit) throw new Error("Unit is required (e.g. 500 g, 1 L).");
  if (!["achar", "ghee", "oil", "other"].includes(input.category)) {
    throw new Error("Choose a category.");
  }
  const price = Math.round(Number(input.price));
  if (!Number.isFinite(price) || price < 1) throw new Error("Enter a valid selling price.");
  const mrpRaw = input.mrp;
  const mrp =
    mrpRaw == null || String(mrpRaw).trim() === ""
      ? null
      : Math.round(Number(mrpRaw));
  if (mrp != null && (!Number.isFinite(mrp) || mrp < price)) {
    throw new Error("MRP should be greater than or equal to selling price.");
  }
  const stock = Math.max(0, Math.floor(Number(input.stock) || 0));
  const imageUrls = normalizeImageUrls(input.imageUrls ?? []);
  const videoUrl = input.videoUrl?.trim() ? toDriveViewUrl(input.videoUrl) : null;
  return {
    ...input,
    name,
    hindiName: input.hindiName?.trim() || undefined,
    description,
    unit,
    price,
    mrp,
    stock,
    imageUrls,
    videoUrl,
    active: Boolean(input.active),
    featured: Boolean(input.featured),
  };
}

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: ProductInput) => validateProduct(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (isFirebaseConfigured) {
      try {
        return await fbUpsertProduct(data);
      } catch {
        /* fall through to local catalog */
      }
    }
    const sql = await getSql();
    const imageJson = JSON.stringify(data.imageUrls);
    if (data.id) {
      await sql.query(
        `update products set
           name = $1, hindi_name = $2, category = $3, description = $4,
           price = $5, mrp = $6, unit = $7, image_urls = $8, video_url = $9,
           stock = $10, active = $11, featured = $12, updated_at = now()
         where id = $13`,
        [
          data.name,
          data.hindiName ?? null,
          data.category,
          data.description,
          data.price,
          data.mrp,
          data.unit,
          imageJson,
          data.videoUrl,
          data.stock,
          data.active,
          data.featured ?? false,
          data.id,
        ],
      );
      const rows = await sql.query<ProductRow>(
        `select ${SELECT_PRODUCT} from products where id = $1`,
        [data.id],
      );
      if (!rows[0]) throw new Error("Product not found.");
      return mapProduct(rows[0]);
    }

    const id = makeId("prod");
    let slug = slugify(data.name) || id;
    const taken = await sql.query<{ slug: string }>(
      `select slug from products where slug = $1`,
      [slug],
    );
    if (taken[0]) slug = `${slug}-${id.slice(-4)}`;
    await sql.query(
      `insert into products (
         id, slug, name, hindi_name, category, description, price, mrp, unit,
         image_urls, video_url, stock, active, featured
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id,
        slug,
        data.name,
        data.hindiName ?? null,
        data.category,
        data.description,
        data.price,
        data.mrp,
        data.unit,
        imageJson,
        data.videoUrl,
        data.stock,
        data.active,
        data.featured ?? false,
      ],
    );
    const rows = await sql.query<ProductRow>(
      `select ${SELECT_PRODUCT} from products where id = $1`,
      [id],
    );
    return mapProduct(rows[0]!);
  });

export const setProductStock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string; stock: number; active?: boolean }) => data)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const stock = Math.max(0, Math.floor(Number(data.stock) || 0));
    if (isFirebaseConfigured) {
      try {
        await fbSetStock(data.id, stock, data.active);
        return { ok: true };
      } catch {
        /* fall through */
      }
    }
    const sql = await getSql();
    if (typeof data.active === "boolean") {
      await sql.query(
        `update products set stock = $1, active = $2, updated_at = now() where id = $3`,
        [stock, data.active, data.id],
      );
    } else {
      await sql.query(
        `update products set stock = $1, updated_at = now() where id = $2`,
        [stock, data.id],
      );
    }
    return { ok: true };
  });

export const listAllOrders = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    if (isFirebaseConfigured) {
      try {
        const orders = await fbListAllOrders();
        if (orders.length) return orders;
      } catch {
        /* fall through */
      }
    }
    const sql = await getSql();
    const rows = await sql.query<OrderRow>(
      `select * from orders order by created_at desc`,
    );
    const orders: Order[] = [];
    for (const row of rows) {
      const items = await sql.query<OrderItemRow>(
        `select id, product_id, product_slug, product_name, unit, price, quantity, image_url
         from order_items where order_id = $1`,
        [row.id],
      );
      const events = await sql.query<OrderEventRow>(
        `select id, status, note, created_at from order_events where order_id = $1 order by created_at asc`,
        [row.id],
      );
      orders.push(mapOrder(row, items.map(mapOrderItem), events.map(mapOrderEvent)));
    }
    return orders;
  });

const STATUS_NOTE: Record<OrderStatus, string> = {
  placed: "Order received",
  confirmed: "Order confirmed by PINAKI Farms",
  packed: "Packed and ready for dispatch",
  shipped: "Handed to courier",
  delivered: "Delivered to customer",
  cancelled: "Order cancelled",
};

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { orderId: string; status: OrderStatus }) => data)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const allowed: OrderStatus[] = [
      "placed",
      "confirmed",
      "packed",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!allowed.includes(data.status)) throw new Error("Invalid status.");
    if (isFirebaseConfigured) {
      try {
        await fbUpdateOrderStatus(data.orderId, data.status);
        return { ok: true };
      } catch (err) {
        if (err instanceof Error && err.message !== "FIREBASE_OFF" && err.message !== "Order not found.") {
          throw err;
        }
      }
    }
    const sql = await getSql();
    const existing = await sql.query<OrderRow>(
      `select * from orders where id = $1`,
      [data.orderId],
    );
    const current = existing[0];
    if (!current) throw new Error("Order not found.");
    if (current.order_status === "cancelled") throw new Error("Cancelled orders cannot be updated.");
    if (current.order_status === "delivered" && data.status !== "delivered") {
      throw new Error("Delivered orders are closed.");
    }

    if (data.status === "cancelled" && current.order_status !== "cancelled") {
      const items = await sql.query<{ product_id: string; quantity: number | string }>(
        `select product_id, quantity from order_items where order_id = $1`,
        [data.orderId],
      );
      for (const item of items) {
        await sql.query(
          `update products set stock = stock + $1, updated_at = now() where id = $2`,
          [Number(item.quantity), item.product_id],
        );
      }
    }

    const paymentStatus =
      data.status === "delivered" && current.payment_method === "cod"
        ? "paid"
        : current.payment_status;

    await sql.query(
      `update orders set order_status = $1, payment_status = $2, updated_at = now() where id = $3`,
      [data.status, paymentStatus, data.orderId],
    );
    await sql.query(
      `insert into order_events (id, order_id, status, note) values ($1,$2,$3,$4)`,
      [makeId("ev"), data.orderId, data.status, STATUS_NOTE[data.status]],
    );
    return { ok: true };
  });
