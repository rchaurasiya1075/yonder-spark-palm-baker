import { Link } from "@tanstack/react-router";
import { CATEGORY_LABEL } from "@/lib/constants";
import type { Product } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/price-tag";

export function ProductCard({ product }: { product: Product }) {
  const img = product.imageUrls[0];
  const out = product.stock <= 0;
  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group flex flex-col overflow-hidden rounded-xl bg-paper ring-1 ring-border transition-shadow duration-200 hover:shadow-[var(--shadow-card)]"
    >
      <div className="relative aspect-square overflow-hidden bg-cream">
        {img ? (
          <img
            src={img}
            alt={product.name}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid size-full place-items-center text-sm text-muted">No image</div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge>{CATEGORY_LABEL[product.category]}</Badge>
          {out ? <Badge tone="muted">Out of stock</Badge> : null}
          {product.mrp != null && product.mrp > product.price ? (
            <Badge tone="accent">Offer</Badge>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.hindiName ? (
          <p className="text-xs tracking-wide text-muted">{product.hindiName}</p>
        ) : null}
        <h3 className="font-display text-lg font-semibold leading-snug text-ink">
          {product.name}
        </h3>
        <p className="text-xs text-muted">{product.unit}</p>
        <div className="mt-auto pt-1">
          <PriceTag price={product.price} mrp={product.mrp} size="sm" />
        </div>
      </div>
    </Link>
  );
}
