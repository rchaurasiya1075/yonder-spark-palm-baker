import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { cartTotal, useCart } from "@/lib/cart";
import { formatInr } from "@/lib/format";
import { PriceTag } from "@/components/price-tag";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const removeItem = useCart((s) => s.removeItem);
  const total = cartTotal(items);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-semibold">Your cart</h1>
      {items.length === 0 ? (
        <div className="mt-10 rounded-xl bg-paper p-10 text-center ring-1 ring-border">
          <p className="text-muted">The cart is empty — the pantry is not.</p>
          <Button asChild className="mt-6">
            <Link to="/shop">Continue shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex flex-col gap-4 rounded-xl bg-paper p-4 ring-1 ring-border sm:flex-row sm:items-center"
            >
              <Link
                to="/product/$slug"
                params={{ slug: item.slug }}
                className="size-24 shrink-0 overflow-hidden rounded-md bg-cream"
              >
                {item.image ? (
                  <img src={item.image} alt="" className="size-full object-cover" />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/product/$slug"
                  params={{ slug: item.slug }}
                  className="font-display text-lg font-semibold hover:underline"
                >
                  {item.name}
                </Link>
                <p className="text-xs text-muted">{item.unit}</p>
                <div className="mt-2">
                  <PriceTag price={item.price} mrp={item.mrp} size="sm" />
                </div>
              </div>
              <QuantityStepper
                value={item.quantity}
                max={item.stock}
                onChange={(n) => setQuantity(item.productId, n)}
              />
              <p className="min-w-20 text-right text-sm font-semibold tabular-nums">
                {formatInr(item.price * item.quantity)}
              </p>
              <button
                type="button"
                className="grid size-11 place-items-center text-muted hover:text-accent"
                onClick={() => removeItem(item.productId)}
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-col items-stretch justify-between gap-4 rounded-xl bg-paper p-5 ring-1 ring-border sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-muted">Subtotal</p>
              <p className="font-display text-2xl font-semibold tabular-nums">
                {formatInr(total)}
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/checkout">Checkout</Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
