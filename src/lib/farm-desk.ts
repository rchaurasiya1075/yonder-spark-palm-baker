import { getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  fbListAllOrders,
  fbListProducts,
  fbSetStock,
  fbUpdateOrderStatus,
  fbUpsertProduct,
} from "@/lib/firebase-data";
import { fbListCustomers } from "@/lib/firebase-users";
import { fbEnsureDefaultCategories, fbListCategories } from "@/lib/firebase-categories";
import { fbEnsureDefaultCoupons } from "@/lib/firebase-coupons";
import {
  listAdminProducts,
  listAllOrders,
  saveProduct,
  setProductStock,
  updateOrderStatus,
} from "@/lib/server/admin";
import type { OrderStatus, Product, ProductInput, ShopCategory, ShopUser } from "@/lib/types";

export async function loadDeskProducts() {
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

export async function loadDeskOrders() {
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

export async function loadDeskCustomers(): Promise<ShopUser[]> {
  if (!isFirebaseConfigured) return [];
  try {
    return await fbListCustomers();
  } catch {
    return [];
  }
}

export async function loadDeskCategories(): Promise<ShopCategory[]> {
  try {
    await fbEnsureDefaultCategories();
  } catch {
    /* optional */
  }
  try {
    return await fbListCategories();
  } catch {
    return [];
  }
}

export async function prepareDesk() {
  try {
    await fbEnsureDefaultCoupons();
  } catch {
    /* optional */
  }
  try {
    await fbEnsureDefaultCategories();
  } catch {
    /* optional */
  }
}

export async function persistProduct(form: ProductInput) {
  if (getFirebaseCurrentUser()) return fbUpsertProduct(form);
  if (import.meta.env.VITE_GITHUB_PAGES === "1") {
    throw new Error("Sign in to save products.");
  }
  return saveProduct({ data: form });
}

export async function persistStock(id: string, stock: number, active?: boolean) {
  if (getFirebaseCurrentUser()) {
    await fbSetStock(id, stock, active);
    return;
  }
  if (import.meta.env.VITE_GITHUB_PAGES === "1") {
    throw new Error("Sign in to update stock.");
  }
  await setProductStock({ data: { id, stock, active } });
}

export async function persistOrderStatus(orderId: string, status: OrderStatus) {
  if (getFirebaseCurrentUser()) {
    await fbUpdateOrderStatus(orderId, status);
    return;
  }
  if (import.meta.env.VITE_GITHUB_PAGES === "1") {
    throw new Error("Sign in to update orders.");
  }
  await updateOrderStatus({ data: { orderId, status } });
}

export function emptyProductForm(category = "achar"): ProductInput {
  return {
    name: "",
    hindiName: "",
    category,
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

export function formFromProduct(p: Product): ProductInput {
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
