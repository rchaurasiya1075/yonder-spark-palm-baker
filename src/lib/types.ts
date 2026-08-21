export type Category = "achar" | "ghee" | "oil" | "other";

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "cod" | "online";
export type PaymentStatus = "pending" | "paid" | "failed";
export type UserRole = "customer" | "admin";

export type Product = {
  id: string;
  slug: string;
  name: string;
  hindiName: string | null;
  category: Category;
  description: string;
  price: number;
  mrp: number | null;
  unit: string;
  imageUrls: string[];
  videoUrl: string | null;
  stock: number;
  active: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  mrp: number | null;
  unit: string;
  image: string | null;
  quantity: number;
  stock: number;
};

export type OrderItem = {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  unit: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
};

export type OrderEvent = {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
};

export type Order = {
  id: string;
  userId: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  email?: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  total: number;
  subtotal?: number;
  discount?: number;
  couponCode?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events: OrderEvent[];
};

export type Profile = {
  userId: string;
  role: UserRole;
  name: string | null;
  phone: string | null;
};

export type ProductInput = {
  id?: string;
  name: string;
  hindiName?: string;
  category: Category;
  description: string;
  price: number;
  mrp?: number | null;
  unit: string;
  imageUrls: string[];
  videoUrl?: string | null;
  stock: number;
  active: boolean;
  featured?: boolean;
};

export const ORDER_FLOW: OrderStatus[] = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Ordered",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
