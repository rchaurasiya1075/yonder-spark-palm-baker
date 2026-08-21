import { CATEGORIES } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import type { ShopCategory } from "@/lib/types";

export function categoryIdFromLabel(label: string) {
  return slugify(label).slice(0, 40) || "other";
}

export function categoryLabel(id: string, categories?: ShopCategory[]) {
  const fromList = categories?.find((c) => c.id === id)?.label;
  if (fromList) return fromList;
  const fromDefaults = CATEGORIES.find((c) => c.id === id)?.label;
  if (fromDefaults) return fromDefaults;
  if (id === "other") return "Farm produce";
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ") || "Farm produce";
}

export function defaultShopCategories(): ShopCategory[] {
  return CATEGORIES.map((cat, index) => ({
    id: cat.id,
    label: cat.label,
    hindi: cat.hindi,
    blurb: cat.blurb,
    sort: index,
    active: true,
  }));
}

export function mergeShopCategories(rows: ShopCategory[]): ShopCategory[] {
  const byId = new Map<string, ShopCategory>();
  for (const row of defaultShopCategories()) byId.set(row.id, row);
  for (const row of rows) {
    if (!row.id) continue;
    byId.set(row.id, { ...byId.get(row.id), ...row, id: row.id });
  }
  return [...byId.values()]
    .filter((row) => row.active !== false)
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
}
