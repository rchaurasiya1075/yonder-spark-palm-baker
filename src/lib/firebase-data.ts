/**
 * Firestore read/write for the live PINAKI catalog and orders.
 * Field names stay compatible with the existing pinaki-1fe56 documents.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { extractYouTubeId, normalizeImageUrls, normalizeVideoUrl } from "@/lib/drive";
import { getFirebaseDb, isFirebaseConfigured, FIRESTORE_COLLECTIONS } from "@/lib/firebase";
import { slugify, makeId, makeOrderId } from "@/lib/utils";
import type {
  Category,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductInput,
  Profile,
} from "@/lib/types";

function dbOrThrow() {
  const db = getFirebaseDb();
  if (!db) throw new Error("FIREBASE_OFF");
  return db;
}

function asStr(value: unknown): string {
  if (typeof value === "string") return value.replace(/^"+|"+$/g, "").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/["₹,\s]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === "t" || value === 1 || value === "1";
}

function mapCategory(raw: unknown): Category {
  const c = asStr(raw).toLowerCase();
  if (c.includes("achar") || c.includes("pickle")) return "achar";
  if (c.includes("ghee")) return "ghee";
  if (c.includes("oil")) return "oil";
  return "other";
}

function pickName(data: Record<string, unknown>): string {
  const direct = asStr(data.name);
  if (direct) return direct;
  for (const [key, value] of Object.entries(data)) {
    if (key.trim() === "name") return asStr(value);
  }
  return "Product";
}

function imageList(data: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const buckets: unknown[] = [
    data.imageUrls,
    data.image_urls,
    data.images,
    data.gallery,
    data.photos,
    data.imageUrl,
    data.image,
  ];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      for (const item of bucket) urls.push(asStr(item));
    } else if (typeof bucket === "string" && bucket.trim()) {
      const raw = bucket.trim();
      if (raw.startsWith("[")) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            for (const item of parsed) urls.push(asStr(item));
            continue;
          }
        } catch {
          /* not json */
        }
      }
      for (const part of raw.split(/[\n,]+/)) urls.push(part);
    }
  }
  return normalizeImageUrls(urls);
}

function pickVideo(data: Record<string, unknown>, images: string[]): string | null {
  const direct = normalizeVideoUrl(asStr(data.videoUrl) || asStr(data.video));
  if (direct) return direct;
  const buckets = [data.imageUrls, data.images, data.image];
  for (const bucket of buckets) {
    const values = Array.isArray(bucket) ? bucket : [bucket];
    for (const item of values) {
      const text = asStr(item);
      if (extractYouTubeId(text)) return normalizeVideoUrl(text);
    }
  }
  for (const img of images) {
    if (extractYouTubeId(img)) return normalizeVideoUrl(img);
  }
  return null;
}

export function mapFirestoreProduct(id: string, data: Record<string, unknown>): Product {
  const name = pickName(data);
  const stockNum = data.stock != null ? asNum(data.stock, -1) : -1;
  const inStock = data.inStock == null ? true : asBool(data.inStock);
  const stock = stockNum >= 0 ? stockNum : inStock ? 25 : 0;
  const active = data.active == null ? true : asBool(data.active);
  const price = asNum(data.price);
  const mrpRaw = data.mrp ?? data.originalPrice;
  const mrp = mrpRaw == null || asStr(mrpRaw) === "" ? null : asNum(mrpRaw);
  const created = asStr(data.createdAt) || new Date().toISOString();
  const updated = asStr(data.updatedAt) || created;
  const video = pickVideo(data, imageList(data));
  const images = imageList(data);
  return {
    id,
    slug: asStr(data.slug) || slugify(name) || id,
    name,
    hindiName: asStr(data.hindiName) || asStr(data.hindi_name) || null,
    category: mapCategory(data.category),
    description: asStr(data.description) || asStr(data.purity) || name,
    price,
    mrp: mrp != null && mrp >= price ? mrp : mrp != null ? price : null,
    unit: asStr(data.unit) || "jar",
    imageUrls: images.filter((u) => !extractYouTubeId(u)),
    videoUrl: video,
    stock,
    active,
    featured: asBool(data.featured) || asStr(data.badge).toLowerCase().includes("best"),
    createdAt: created,
    updatedAt: updated,
  };
}

function mapStatus(raw: unknown): OrderStatus {
  const s = asStr(raw).toLowerCase();
  if (s === "confirmed") return "confirmed";
  if (s === "packed") return "packed";
  if (s === "shipped") return "shipped";
  if (s === "delivered") return "delivered";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "placed";
}

function mapPaymentMethod(raw: unknown): PaymentMethod {
  const s = asStr(raw).toLowerCase();
  return s === "online" || s === "upi" || s === "razorpay" ? "online" : "cod";
}

function mapPaymentStatus(raw: unknown, method: PaymentMethod): PaymentStatus {
  const s = asStr(raw).toLowerCase();
  if (s === "paid" || s === "success") return "paid";
  if (s === "failed") return "failed";
  if (s.includes("cash") || method === "cod") return "pending";
  return "pending";
}

function mapItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const id = asStr(row.id) || makeId("oi");
    return {
      id: `${id}-${index}`,
      productId: asStr(row.id) || asStr(row.productId) || id,
      productSlug: asStr(row.slug) || asStr(row.productSlug) || slugify(asStr(row.name)),
      productName: asStr(row.name) || asStr(row.productName) || "Item",
      unit: asStr(row.unit) || "",
      price: asNum(row.price),
      quantity: Math.max(1, asNum(row.quantity, 1)),
      imageUrl: asStr(row.image) || asStr(row.imageUrl) || null,
    };
  });
}

function mapEvents(data: Record<string, unknown>): OrderEvent[] {
  const tracking =
    data.tracking && typeof data.tracking === "object"
      ? (data.tracking as Record<string, unknown>)
      : null;
  const fromTracking = Array.isArray(tracking?.events) ? tracking.events : [];
  const fromEvents = Array.isArray(data.events) ? data.events : [];
  const source = fromTracking.length ? fromTracking : fromEvents;
  return source.map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      id: asStr(row.id) || makeId("ev"),
      status: mapStatus(row.status),
      note: asStr(row.description) || asStr(row.title) || asStr(row.note) || null,
      createdAt: asStr(row.at) || asStr(row.createdAt) || new Date().toISOString(),
    };
  });
}

export function mapFirestoreOrder(id: string, data: Record<string, unknown>): Order {
  const addr =
    data.deliveryAddress && typeof data.deliveryAddress === "object"
      ? (data.deliveryAddress as Record<string, unknown>)
      : {};
  const method = mapPaymentMethod(data.paymentMethod);
  const created = asStr(data.createdAt) || new Date().toISOString();
  const status = mapStatus(data.status ?? data.orderStatus);
  return {
    id,
    userId: asStr(data.userId),
    customerName: asStr(addr.name) || asStr(data.customerName) || "Customer",
    phone: asStr(addr.phone) || asStr(data.phone),
    address: asStr(addr.address) || asStr(data.address) || asStr(data.addressText),
    city: asStr(addr.city) || asStr(data.city),
    pincode: asStr(addr.pincode) || asStr(data.pincode),
    email: asStr(data.email) || null,
    paymentMethod: method,
    paymentStatus: mapPaymentStatus(data.paymentStatus, method),
    orderStatus: status,
    total: asNum(data.total),
    subtotal: asNum(data.subtotal) || asNum(data.total) + asNum(data.discount),
    discount: asNum(data.discount),
    couponCode: asStr(data.couponCode) || null,
    createdAt: created,
    updatedAt: asStr(data.updatedAt) || created,
    items: mapItems(data.items),
    events: mapEvents(data),
  };
}

export async function fbListProducts(opts?: {
  category?: Category;
  includeHidden?: boolean;
}): Promise<Product[]> {
  if (!isFirebaseConfigured) throw new Error("FIREBASE_OFF");
  const db = dbOrThrow();
  const snap = await getDocs(collection(db, FIRESTORE_COLLECTIONS.products));
  let products = snap.docs.map((d) => mapFirestoreProduct(d.id, d.data() as Record<string, unknown>));
  if (!opts?.includeHidden) products = products.filter((p) => p.active);
  if (opts?.category) products = products.filter((p) => p.category === opts.category);
  products.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
  return products;
}

export async function fbGetProductBySlug(slug: string): Promise<Product | null> {
  const products = await fbListProducts({ includeHidden: true });
  return products.find((p) => p.slug === slug || p.id === slug) ?? null;
}

export async function fbGetProductById(id: string): Promise<Product | null> {
  const db = dbOrThrow();
  const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.products, id));
  if (!snap.exists()) return null;
  return mapFirestoreProduct(snap.id, snap.data() as Record<string, unknown>);
}

export function productToFirestore(product: Product) {
  return {
    name: product.name,
    hindiName: product.hindiName,
    slug: product.slug,
    category: product.category,
    description: product.description,
    price: product.price,
    originalPrice: product.mrp ?? product.price,
    mrp: product.mrp,
    unit: product.unit,
    image: product.imageUrls[0] ?? "",
    imageUrls: product.imageUrls,
    video: product.videoUrl ?? "",
    videoUrl: product.videoUrl,
    stock: product.stock,
    inStock: product.stock > 0,
    active: product.active,
    featured: product.featured,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function fbUpsertProduct(input: ProductInput & { slug?: string }): Promise<Product> {
  const db = dbOrThrow();
  const now = new Date().toISOString();
  const id = input.id || makeId("prod");
  const existing = input.id ? await fbGetProductById(id) : null;
  const slug = input.slug || existing?.slug || slugify(input.name) || id;
  const product: Product = {
    id,
    slug,
    name: input.name,
    hindiName: input.hindiName?.trim() || null,
    category: input.category,
    description: input.description,
    price: input.price,
    mrp: input.mrp ?? null,
    unit: input.unit,
    imageUrls: normalizeImageUrls(input.imageUrls ?? []),
    videoUrl: normalizeVideoUrl(input.videoUrl) ?? normalizeVideoUrl(
      (input.imageUrls ?? []).find((u) => extractYouTubeId(u)) ?? "",
    ),
    stock: input.stock,
    active: input.active,
    featured: Boolean(input.featured),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.products, id), productToFirestore(product), {
    merge: true,
  });
  return product;
}

export async function fbSetStock(id: string, stock: number, active?: boolean) {
  const db = dbOrThrow();
  const patch: Record<string, unknown> = {
    stock,
    inStock: stock > 0,
    updatedAt: new Date().toISOString(),
  };
  if (typeof active === "boolean") patch.active = active;
  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.products, id), patch);
}

function isPermissionDenied(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  const message = err instanceof Error ? err.message : "";
  return code === "permission-denied" || /insufficient permissions/i.test(message);
}

async function tryDecrementStock(productId: string, nextStock: number) {
  try {
    await fbSetStock(productId, nextStock);
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
  }
}

export async function fbSeedMissing(products: Product[]) {
  if (!products.length) return;
  const existing = await fbListProducts({ includeHidden: true });
  const names = new Set(existing.map((p) => p.name.toLowerCase()));
  for (const product of products) {
    if (names.has(product.name.toLowerCase())) continue;
    await setDoc(
      doc(dbOrThrow(), FIRESTORE_COLLECTIONS.products, product.id),
      productToFirestore(product),
      { merge: true },
    );
    names.add(product.name.toLowerCase());
  }
}

export type FbCheckout = {
  userId: string;
  email?: string | null;
  name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  paymentMethod: PaymentMethod;
  items: { product: Product; quantity: number }[];
  couponCode?: string | null;
};

export async function fbPlaceOrder(input: FbCheckout): Promise<Order> {
  const db = dbOrThrow();
  const now = new Date().toISOString();
  const orderId = makeOrderId();
  const subtotal = input.items.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const { resolveCouponDiscount } = await import("@/lib/firebase-coupons");
  const coupon = await resolveCouponDiscount(input.couponCode, subtotal);
  if (input.couponCode?.trim() && coupon.error) {
    throw new Error(coupon.error);
  }
  const discount = coupon.discount;
  const total = Math.max(0, subtotal - discount);
  const paymentStatus: PaymentStatus = input.paymentMethod === "online" ? "paid" : "pending";
  const note =
    input.paymentMethod === "online"
      ? "Order placed · online payment received"
      : "Order placed · cash on delivery";

  for (const line of input.items) {
    const nextStock = Math.max(0, line.product.stock - line.quantity);
    await tryDecrementStock(line.product.id, nextStock);
  }

  const payload = {
    userId: input.userId,
    email: input.email ?? "",
    customerName: input.name,
    phone: input.phone,
    address: input.address,
    city: input.city,
    pincode: input.pincode,
    addressText: `${input.address}, ${input.city}, ${input.pincode}`,
    deliveryAddress: {
      name: input.name,
      phone: input.phone,
      address: input.address,
      city: input.city,
      state: "",
      pincode: input.pincode,
      landmark: "",
    },
    items: input.items.map((line) => ({
      id: line.product.id,
      slug: line.product.slug,
      name: line.product.name,
      unit: line.product.unit,
      image: line.product.imageUrls[0] ?? "",
      quantity: line.quantity,
      price: line.product.price,
    })),
    total,
    subtotal,
    discount,
    couponCode: coupon.coupon?.code ?? "",
    status: "placed",
    orderStatus: "placed",
    paymentMethod: input.paymentMethod === "cod" ? "COD" : "Online",
    paymentStatus: input.paymentMethod === "cod" ? "cash_on_delivery" : "paid",
    tracking: {
      courierName: "Awaiting courier assignment",
      trackingNumber: "",
      events: [
        {
          at: now,
          title: "Order placed",
          status: "placed",
          description: note,
        },
      ],
    },
    events: [{ id: makeId("ev"), status: "placed", note, createdAt: now }],
    cancellationAllowed: true,
    returnPolicyDays: 7,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, FIRESTORE_COLLECTIONS.orders, orderId), payload);
  return mapFirestoreOrder(orderId, payload as unknown as Record<string, unknown>);
}

export async function fbListAllOrders(): Promise<Order[]> {
  const db = dbOrThrow();
  const snap = await getDocs(collection(db, FIRESTORE_COLLECTIONS.orders));
  const orders = snap.docs
    .map((d) => mapFirestoreOrder(d.id, d.data() as Record<string, unknown>))
    .filter((o) => o.customerName !== "Customer" || o.items.length > 0 || o.total > 0);
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return orders;
}

export async function fbListMyOrders(userId: string, email?: string | null): Promise<Order[]> {
  const db = dbOrThrow();
  const col = collection(db, FIRESTORE_COLLECTIONS.orders);
  const found = new Map<string, Order>();
  const snaps = await Promise.all([
    getDocs(query(col, where("userId", "==", userId))),
    email?.trim()
      ? getDocs(query(col, where("email", "==", email.trim())))
      : Promise.resolve(null),
  ]);
  for (const snap of snaps) {
    if (!snap) continue;
    for (const d of snap.docs) {
      found.set(d.id, mapFirestoreOrder(d.id, d.data() as Record<string, unknown>));
    }
  }
  return [...found.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fbGetOrder(orderId: string): Promise<Order | null> {
  const db = dbOrThrow();
  const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.orders, orderId));
  if (!snap.exists()) return null;
  return mapFirestoreOrder(snap.id, snap.data() as Record<string, unknown>);
}

const STATUS_NOTE: Record<OrderStatus, string> = {
  placed: "Order received",
  confirmed: "Order confirmed by PINAKI Farms",
  packed: "Packed and ready for dispatch",
  shipped: "Handed to courier",
  delivered: "Delivered to customer",
  cancelled: "Order cancelled",
};

export async function fbUpdateOrderStatus(orderId: string, status: OrderStatus) {
  const db = dbOrThrow();
  const current = await fbGetOrder(orderId);
  if (!current) throw new Error("Order not found.");
  if (current.orderStatus === "cancelled") throw new Error("Cancelled orders cannot be updated.");
  if (current.orderStatus === "delivered" && status !== "delivered") {
    throw new Error("Delivered orders are closed.");
  }
  const now = new Date().toISOString();
  const paymentStatus =
    status === "delivered" && current.paymentMethod === "cod" ? "paid" : current.paymentStatus;
  const event = {
    at: now,
    title: STATUS_NOTE[status],
    status,
    description: STATUS_NOTE[status],
    id: makeId("ev"),
    note: STATUS_NOTE[status],
    createdAt: now,
  };
  const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.orders, orderId));
  const raw = (snap.data() ?? {}) as Record<string, unknown>;
  const tracking =
    raw.tracking && typeof raw.tracking === "object"
      ? (raw.tracking as Record<string, unknown>)
      : {};
  const prevEvents = Array.isArray(tracking.events) ? tracking.events : [];
  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.orders, orderId), {
    status,
    orderStatus: status,
    paymentStatus:
      paymentStatus === "paid" ? "paid" : current.paymentMethod === "cod" ? "cash_on_delivery" : current.paymentStatus,
    updatedAt: now,
    tracking: {
      courierName: tracking.courierName ?? "Awaiting courier assignment",
      trackingNumber: tracking.trackingNumber ?? "",
      events: [...prevEvents, event],
    },
  });
  if (status === "cancelled") {
    for (const item of current.items) {
      const product = await fbGetProductById(item.productId);
      if (product) await fbSetStock(product.id, product.stock + item.quantity, product.active);
    }
  }
}

export async function fbEnsureUser(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  role?: Profile["role"];
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}) {
  const db = dbOrThrow();
  const now = new Date().toISOString();
  const userRef = doc(db, FIRESTORE_COLLECTIONS.users, input.userId);
  const profileRef = doc(db, FIRESTORE_COLLECTIONS.profiles, input.userId);
  const existing = await getDoc(userRef);
  const prev = existing.exists() ? (existing.data() as Record<string, unknown>) : null;
  const prevRole = prev?.role as string | undefined;
  const role = input.role === "admin" ? "admin" : prevRole === "admin" ? "admin" : "customer";
  const patch: Record<string, unknown> = {
    uid: input.userId,
    role,
    updatedAt: now,
  };
  if (input.email) patch.email = input.email;
  if (input.name) patch.name = input.name;
  if (input.phone) patch.phone = input.phone;
  if (input.firstName) patch.firstName = input.firstName;
  if (input.lastName) patch.lastName = input.lastName;
  if (input.username) patch.username = input.username;
  if (!existing.exists()) {
    patch.createdAt = now;
    patch.email = input.email ?? "";
    patch.name = input.name ?? "";
    patch.phone = input.phone ?? "";
    patch.firstName = input.firstName ?? "";
    patch.lastName = input.lastName ?? "";
    patch.username = input.username ?? "";
    patch.addresses = [];
  }
  await setDoc(userRef, patch, { merge: true });
  const profilePatch: Record<string, unknown> = {
    userId: input.userId,
    role,
  };
  if (input.name) profilePatch.name = input.name;
  if (input.phone) profilePatch.phone = input.phone;
  await setDoc(profileRef, profilePatch, { merge: true });
}

export async function fbGetProfile(userId: string): Promise<Profile | null> {
  const db = dbOrThrow();
  const profileSnap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.profiles, userId));
  if (profileSnap.exists()) {
    const data = profileSnap.data() as Record<string, unknown>;
    return {
      userId,
      role: asStr(data.role) === "admin" ? "admin" : "customer",
      name: asStr(data.name) || null,
      phone: asStr(data.phone) || null,
    };
  }
  const userSnap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.users, userId));
  if (!userSnap.exists()) return null;
  const data = userSnap.data() as Record<string, unknown>;
  return {
    userId,
    role: asStr(data.role) === "admin" ? "admin" : "customer",
    name: asStr(data.name) || null,
    phone: asStr(data.phone) || null,
  };
}
