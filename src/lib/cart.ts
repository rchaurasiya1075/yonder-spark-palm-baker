import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product } from "./types";

type CartState = {
  items: CartItem[];
  couponCode: string | null;
  addItem: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  setCouponCode: (code: string | null) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      addItem: (product, quantity = 1) => {
        const qty = Math.max(1, Math.min(quantity, Math.max(1, product.stock)));
        const existing = get().items.find((i) => i.productId === product.id);
        if (existing) {
          const next = Math.min(existing.quantity + qty, product.stock);
          set({
            items: get().items.map((i) =>
              i.productId === product.id
                ? { ...i, quantity: next, stock: product.stock, price: product.price }
                : i,
            ),
          });
          return;
        }
        set({
          items: [
            ...get().items,
            {
              productId: product.id,
              slug: product.slug,
              name: product.name,
              price: product.price,
              mrp: product.mrp,
              unit: product.unit,
              image: product.imageUrls[0] ?? null,
              quantity: qty,
              stock: product.stock,
            },
          ],
        });
      },
      setQuantity: (productId, quantity) => {
        if (quantity < 1) {
          set({ items: get().items.filter((i) => i.productId !== productId) });
          return;
        }
        set({
          items: get().items.map((i) =>
            i.productId === productId
              ? { ...i, quantity: Math.min(quantity, Math.max(1, i.stock)) }
              : i,
          ),
        });
      },
      removeItem: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),
      setCouponCode: (code) => set({ couponCode: code }),
      clear: () => set({ items: [], couponCode: null }),
    }),
    { name: "pinaki-cart-v1" },
  ),
);

export function cartCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}
