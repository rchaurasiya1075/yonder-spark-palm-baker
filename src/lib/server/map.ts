import { toIso } from "@/lib/format";
import type {
  Category,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  Profile,
  UserRole,
} from "@/lib/types";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  hindi_name: string | null;
  category: string;
  description: string;
  price: number | string;
  mrp: number | string | null;
  unit: string;
  image_urls: string;
  video_url: string | null;
  stock: number | string;
  active: boolean | number | string;
  featured: boolean | number | string;
  created_at: string | Date;
  updated_at: string | Date;
};

function asBool(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}

function asNum(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === "string" && u.length > 0);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((u): u is string => typeof u === "string" && u.length > 0);
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    hindiName: row.hindi_name,
    category: row.category as Category,
    description: row.description,
    price: asNum(row.price),
    mrp: row.mrp == null ? null : asNum(row.mrp),
    unit: row.unit,
    imageUrls: parseUrls(row.image_urls),
    videoUrl: row.video_url,
    stock: asNum(row.stock),
    active: asBool(row.active),
    featured: asBool(row.featured),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export type OrderRow = {
  id: string;
  user_id: string;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  total: number | string;
  created_at: string | Date;
  updated_at: string | Date;
};

export type OrderItemRow = {
  id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  unit: string;
  price: number | string;
  quantity: number | string;
  image_url: string | null;
};

export type OrderEventRow = {
  id: string;
  status: string;
  note: string | null;
  created_at: string | Date;
};

export function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    productId: row.product_id,
    productSlug: row.product_slug,
    productName: row.product_name,
    unit: row.unit,
    price: asNum(row.price),
    quantity: asNum(row.quantity),
    imageUrl: row.image_url,
  };
}

export function mapOrderEvent(row: OrderEventRow): OrderEvent {
  return {
    id: row.id,
    status: row.status as OrderStatus,
    note: row.note,
    createdAt: toIso(row.created_at),
  };
}

export function mapOrder(
  row: OrderRow,
  items: OrderItem[] = [],
  events: OrderEvent[] = [],
): Order {
  return {
    id: row.id,
    userId: row.user_id,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    pincode: row.pincode,
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    orderStatus: row.order_status as OrderStatus,
    total: asNum(row.total),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    items,
    events,
  };
}

export function mapProfile(row: {
  user_id: string;
  role: string;
  name: string | null;
  phone: string | null;
}): Profile {
  return {
    userId: row.user_id,
    role: row.role as UserRole,
    name: row.name,
    phone: row.phone,
  };
}
