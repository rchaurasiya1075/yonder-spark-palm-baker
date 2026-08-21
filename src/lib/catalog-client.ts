import { isGithubPages } from "@/lib/public-url";
import { isFirebaseConfigured } from "@/lib/firebase";
import { fbGetProductBySlug, fbListProducts } from "@/lib/firebase-data";
import { fbListCategories } from "@/lib/firebase-categories";
import { defaultShopCategories } from "@/lib/categories";
import type { Category, Product, ShopCategory } from "@/lib/types";

export async function loadProducts(opts?: {
  category?: Category;
  includeHidden?: boolean;
}): Promise<Product[]> {
  if (isFirebaseConfigured) {
    try {
      const rows = await fbListProducts(opts);
      if (rows.length || isGithubPages) return rows;
    } catch {
      if (isGithubPages) return [];
    }
  }
  if (isGithubPages) return [];
  try {
    const { listProducts } = await import("@/lib/server/catalog");
    return await listProducts({ data: opts ?? {} });
  } catch {
    return [];
  }
}

export async function loadProductBySlug(slug: string): Promise<Product | null> {
  if (isFirebaseConfigured) {
    try {
      const product = await fbGetProductBySlug(slug);
      if (product || isGithubPages) return product;
    } catch {
      if (isGithubPages) return null;
    }
  }
  if (isGithubPages) return null;
  try {
    const { getProductBySlug } = await import("@/lib/server/catalog");
    return await getProductBySlug({ data: slug });
  } catch {
    return null;
  }
}

export async function loadShopCategories(): Promise<ShopCategory[]> {
  if (isFirebaseConfigured) {
    try {
      return await fbListCategories();
    } catch {
      if (isGithubPages) return defaultShopCategories();
    }
  }
  return defaultShopCategories();
}
