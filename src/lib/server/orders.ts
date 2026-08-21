import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  fbEnsureUser,
  fbGetOrder,
  fbGetProductById,
  fbListMyOrders,
  fbPlaceOrder,
} from "@/lib/firebase-data";
import { makeId, makeOrderId } from "@/lib/utils";
import type { Order, PaymentMethod } from "@/lib/types";
import {
  mapOrder,
  mapOrderEvent,
  mapOrderItem,
  mapProduct,
  mapProfile,
  type OrderEventRow,
  type OrderItemRow,
  type OrderRow,
  type ProductRow,
} from "./map";

const SELECT_PRODUCT = `
  id, slug, name, hindi_name, category, description, price, mrp, unit,
  image_urls, video_url, stock, active, featured, created_at, updated_at
`;

async function ensureProfile(userId: string, name?: string | null) {
  const sql = await getSql();
  await sql.query(
    `insert into profiles (user_id, role, name) values ($1, 'customer', $2)
     on conflict (user_id) do nothing`,
    [userId, name ?? null],
  );
}

async function loadOrderBundle(orderId: string): Promise<Order | null> {
  const sql = await getSql();
  const orders = await sql.query<OrderRow>(`select * from orders where id = $1`, [orderId]);
  const row = orders[0];
  if (!row) return null;
  const items = await sql.query<OrderItemRow>(
    `select id, product_id, product_slug, product_name, unit, price, quantity, image_url
     from order_items where order_id = $1`,
    [orderId],
  );
  const events = await sql.query<OrderEventRow>(
    `select id, status, note, created_at from order_events where order_id = $1 order by created_at asc`,
    [orderId],
  );
  return mapOrder(row, items.map(mapOrderItem), events.map(mapOrderEvent));
}

export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (isFirebaseConfigured) {
      try {
        await fbEnsureUser({ userId: context.userId, email: context.email });
      } catch {
        /* optional */
      }
    }
    await ensureProfile(context.userId);
    const sql = await getSql();
    const rows = await sql.query<{
      user_id: string;
      role: string;
      name: string | null;
      phone: string | null;
    }>(`select user_id, role, name, phone from profiles where user_id = $1`, [context.userId]);
    return rows[0] ? mapProfile(rows[0]) : { userId: context.userId, role: "customer" as const, name: null, phone: null };
  });

export type CheckoutInput = {
  name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  paymentMethod: PaymentMethod;
  items: { productId: string; quantity: number }[];
};

function validateCheckout(data: CheckoutInput): CheckoutInput {
  const name = data.name.trim();
  const phone = data.phone.replace(/\s+/g, "");
  const address = data.address.trim();
  const city = data.city.trim();
  const pincode = data.pincode.trim();
  if (name.length < 2) throw new Error("Please enter your full name.");
  if (!/^[0-9]{10}$/.test(phone)) throw new Error("Enter a 10-digit mobile number.");
  if (address.length < 8) throw new Error("Please enter a complete delivery address.");
  if (city.length < 2) throw new Error("Please enter your city.");
  if (!/^[0-9]{6}$/.test(pincode)) throw new Error("Enter a 6-digit pincode.");
  if (data.paymentMethod !== "cod" && data.paymentMethod !== "online") {
    throw new Error("Choose a payment method.");
  }
  if (!data.items?.length) throw new Error("Your cart is empty.");
  return { name, phone, address, city, pincode, paymentMethod: data.paymentMethod, items: data.items };
}

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: CheckoutInput) => validateCheckout(data))
  .handler(async ({ context, data }) => {
    if (isFirebaseConfigured) {
      try {
        const lines: { product: NonNullable<Awaited<ReturnType<typeof fbGetProductById>>>; quantity: number }[] = [];
        for (const item of data.items) {
          const qty = Math.floor(Number(item.quantity));
          if (!Number.isFinite(qty) || qty < 1) throw new Error("Invalid quantity.");
          const product = await fbGetProductById(item.productId);
          if (!product || !product.active) throw new Error("A product in your cart is no longer available.");
          if (product.stock < qty) throw new Error(`${product.name} has only ${product.stock} left.`);
          lines.push({ product, quantity: qty });
        }
        const order = await fbPlaceOrder({
          userId: context.userId,
          email: context.email,
          name: data.name,
          phone: data.phone,
          address: data.address,
          city: data.city,
          pincode: data.pincode,
          paymentMethod: data.paymentMethod,
          items: lines,
        });
        await fbEnsureUser({
          userId: context.userId,
          email: context.email,
          name: data.name,
          phone: data.phone,
        });
        return order;
      } catch (err) {
        if (err instanceof Error && err.message !== "FIREBASE_OFF") {
          if (
            err.message.includes("no longer available") ||
            err.message.includes("only") ||
            err.message.includes("Invalid quantity")
          ) {
            throw err;
          }
        }
        /* fall through to local orders if firebase write fails unexpectedly */
        if (err instanceof Error && /available|only|Invalid/.test(err.message)) throw err;
      }
    }
    await ensureProfile(context.userId, data.name);
    const sql = await getSql();
    const lines: {
      product: ReturnType<typeof mapProduct>;
      quantity: number;
    }[] = [];

    for (const item of data.items) {
      const qty = Math.floor(Number(item.quantity));
      if (!Number.isFinite(qty) || qty < 1) throw new Error("Invalid quantity.");
      const rows = await sql.query<ProductRow>(
        `select ${SELECT_PRODUCT} from products where id = $1`,
        [item.productId],
      );
      const product = rows[0] ? mapProduct(rows[0]) : null;
      if (!product || !product.active) throw new Error("A product in your cart is no longer available.");
      if (product.stock < qty) {
        throw new Error(`${product.name} has only ${product.stock} left.`);
      }
      lines.push({ product, quantity: qty });
    }

    const total = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
    const orderId = makeOrderId();
    const paymentStatus = data.paymentMethod === "online" ? "paid" : "pending";

    for (const line of lines) {
      const updated = await sql.query<{ id: string }>(
        `update products set stock = stock - $1, updated_at = now()
         where id = $2 and stock >= $1 and active = true returning id`,
        [line.quantity, line.product.id],
      );
      if (!updated[0]) throw new Error(`${line.product.name} just went out of stock.`);
    }

    await sql.query(
      `insert into orders (
         id, user_id, customer_name, phone, address, city, pincode,
         payment_method, payment_status, order_status, total
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'placed',$10)`,
      [
        orderId,
        context.userId,
        data.name,
        data.phone,
        data.address,
        data.city,
        data.pincode,
        data.paymentMethod,
        paymentStatus,
        total,
      ],
    );

    for (const line of lines) {
      await sql.query(
        `insert into order_items (
           id, order_id, product_id, product_slug, product_name, unit, price, quantity, image_url
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          makeId("oi"),
          orderId,
          line.product.id,
          line.product.slug,
          line.product.name,
          line.product.unit,
          line.product.price,
          line.quantity,
          line.product.imageUrls[0] ?? null,
        ],
      );
    }

    await sql.query(
      `insert into order_events (id, order_id, status, note) values ($1,$2,'placed',$3)`,
      [
        makeId("ev"),
        orderId,
        data.paymentMethod === "online"
          ? "Order placed · online payment received"
          : "Order placed · cash on delivery",
      ],
    );

    await sql.query(
      `update profiles set name = coalesce(name, $1), phone = $2 where user_id = $3`,
      [data.name, data.phone, context.userId],
    );

    const order = await loadOrderBundle(orderId);
    if (!order) throw new Error("Order could not be loaded.");
    return order;
  });

export const listMyOrders = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (isFirebaseConfigured) {
      try {
        const rows = await fbListMyOrders(context.userId, context.email);
        if (rows.length) return rows;
      } catch {
        /* fall through */
      }
    }
    const sql = await getSql();
    const rows = await sql.query<OrderRow>(
      `select * from orders where user_id = $1 order by created_at desc`,
      [context.userId],
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

export const getMyOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { orderId: string }) => data)
  .handler(async ({ context, data }) => {
    if (isFirebaseConfigured) {
      try {
        const order = await fbGetOrder(data.orderId);
        if (order) {
          if (order.userId === context.userId) return order;
          if (context.email && order.email?.toLowerCase() === context.email.toLowerCase()) return order;
          const sql = await getSql();
          const roles = await sql.query<{ role: string }>(
            `select role from profiles where user_id = $1`,
            [context.userId],
          );
          if (roles[0]?.role === "admin") return order;
        }
      } catch {
        /* fall through */
      }
    }
    const order = await loadOrderBundle(data.orderId);
    if (!order) return null;
    if (order.userId === context.userId) return order;
    const sql = await getSql();
    const roles = await sql.query<{ role: string }>(
      `select role from profiles where user_id = $1`,
      [context.userId],
    );
    if (roles[0]?.role === "admin") return order;
    return null;
  });
