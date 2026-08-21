import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CATEGORY_LABEL } from "@/lib/constants";
import { useCart } from "@/lib/cart";
import { loadProductBySlug, loadProducts } from "@/lib/catalog-client";
import { ProductGallery } from "@/components/product-gallery";
import { ProductCard } from "@/components/product-card";
import { PriceTag } from "@/components/price-tag";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const product = await loadProductBySlug(params.slug);
    if (!product || !product.active) throw notFound();
    const related = (await loadProducts({ category: product.category })).filter(
      (p) => p.id !== product.id,
    );
    return { product, related: related.slice(0, 3) };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product, related } = Route.useLoaderData();
  const addItem = useCart((s) => s.addItem);
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const out = product.stock <= 0;
  const max = Math.max(1, product.stock);

  function addToCart() {
    if (out) return;
    addItem(product, qty);
    toast.success(`${product.name} added to cart`);
  }

  function buyNow() {
    if (out) return;
    addItem(product, qty);
    void navigate({ to: "/checkout" });
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs text-muted">
        <Link to="/shop" className="hover:underline">
          Shop
        </Link>
        <span className="px-2">/</span>
        <Link to="/shop" search={{ category: product.category }} className="hover:underline">
          {CATEGORY_LABEL[product.category]}
        </Link>
      </p>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductGallery
          images={product.imageUrls}
          name={product.name}
          videoUrl={product.videoUrl}
        />
        <div>
          <Badge>{CATEGORY_LABEL[product.category]}</Badge>
          {product.hindiName ? (
            <p className="mt-3 text-sm text-muted">{product.hindiName}</p>
          ) : null}
          <h1 className="mt-1 font-display text-4xl font-semibold">{product.name}</h1>
          <p className="mt-2 text-sm text-muted">{product.unit}</p>
          <div className="mt-5">
            <PriceTag price={product.price} mrp={product.mrp} size="lg" />
          </div>
          <p className="mt-3 text-sm">
            {out ? (
              <span className="font-semibold text-accent">Out of stock</span>
            ) : product.stock <= 8 ? (
              <span className="font-medium text-accent">Only {product.stock} left</span>
            ) : (
              <span className="text-forest">In stock · {product.stock} jars</span>
            )}
          </p>
          <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink/85">
            {product.description}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <QuantityStepper value={qty} max={max} onChange={setQty} />
            <Button onClick={addToCart} disabled={out} className="min-h-11 flex-1 sm:flex-none">
              Add to cart
            </Button>
            <Button
              variant="forest"
              onClick={buyNow}
              disabled={out}
              className="min-h-11 flex-1 sm:flex-none"
            >
              Buy now
            </Button>
          </div>
        </div>
      </div>
      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold">You may also like</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
