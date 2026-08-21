import { isGithubPages } from "@/lib/public-url";
import { isFirebaseConfigured } from "@/lib/firebase";
import { fbGetProductBySlug, fbListProducts } from "@/lib/firebase-data";
import type { Category, Product } from "@/lib/types";

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
