import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { defaultShopCategories, mergeShopCategories } from "@/lib/categories";
import { FIRESTORE_COLLECTIONS, getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import type { ShopCategory } from "@/lib/types";
import { slugify } from "@/lib/utils";

function dbOrThrow() {
  const db = getFirebaseDb();
  if (!db) throw new Error("FIREBASE_OFF");
  return db;
}

function mapCategory(id: string, data: Record<string, unknown>): ShopCategory {
  const label = String(data.label ?? id).trim() || id;
  return {
    id,
    label,
    hindi: String(data.hindi ?? "").trim(),
    blurb: String(data.blurb ?? "").trim(),
    sort: Number(data.sort ?? 99) || 99,
    active: data.active !== false,
  };
}

export async function fbListCategories(): Promise<ShopCategory[]> {
  if (!isFirebaseConfigured) return defaultShopCategories();
  const snap = await getDocs(collection(dbOrThrow(), FIRESTORE_COLLECTIONS.categories));
  const rows = snap.docs.map((d) => mapCategory(d.id, d.data() as Record<string, unknown>));
  return mergeShopCategories(rows);
}

export async function fbEnsureDefaultCategories() {
  if (!isFirebaseConfigured) return;
  const db = dbOrThrow();
  const snap = await getDocs(collection(db, FIRESTORE_COLLECTIONS.categories));
  if (!snap.empty) return;
  const now = new Date().toISOString();
  for (const cat of defaultShopCategories()) {
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.categories, cat.id), { ...cat, createdAt: now, updatedAt: now });
  }
}

export async function fbUpsertCategory(input: {
  id?: string;
  label: string;
  hindi?: string;
  blurb?: string;
  sort?: number;
  active?: boolean;
}): Promise<ShopCategory> {
  const label = input.label.trim();
  if (!label) throw new Error("Category name is required.");
  const id = (input.id || slugify(label).slice(0, 40) || "other").toLowerCase();
  const row: ShopCategory = {
    id,
    label,
    hindi: (input.hindi ?? "").trim(),
    blurb: (input.blurb ?? "").trim(),
    sort: input.sort ?? 50,
    active: input.active !== false,
  };
  await setDoc(
    doc(dbOrThrow(), FIRESTORE_COLLECTIONS.categories, id),
    { ...row, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  return row;
}
