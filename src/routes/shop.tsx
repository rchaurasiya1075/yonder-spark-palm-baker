import { createFileRoute, Link } from "@tanstack/react-router";
import { loadProducts, loadShopCategories } from "@/lib/catalog-client";
import { categoryLabel } from "@/lib/categories";
import type { Category } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { cn } from "@/lib/utils";

function parseCategory(value: unknown): Category | undefined {
  if (typeof value !== "string") return undefined;
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return undefined;
  return slug;
}

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): { category?: Category } => {
    const category = parseCategory(search.category);
    return category ? { category } : {};
  },
  loaderDeps: ({ search }) => ({ category: search.category }),
  loader: async ({ deps }) => {
    const [products, categories] = await Promise.all([
      loadProducts({ category: deps.category }),
      loadShopCategories(),
    ]);
    return { products, categories };
  },
  component: ShopPage,
});

function ShopPage() {
  const { products, categories } = Route.useLoaderData();
  const { category } = Route.useSearch();
  const current = categories.find((c) => c.id === category);
  const title = current?.label ?? (category ? categoryLabel(category, categories) : "The farm shop");
  const hindi = current?.hindi;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        {hindi || "PINAKI Farms"}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold">{title}</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Small-batch achar, A2 bilona ghee, and cold-pressed oils. Jars leave the
        farm kitchen when they are ready — not before.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          to="/shop"
          search={{}}
          className={cn(
            "inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold ring-1",
            !category ? "bg-ink text-paper ring-ink" : "bg-paper text-ink ring-border",
          )}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to="/shop"
            search={{ category: cat.id }}
            className={cn(
              "inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold ring-1",
              category === cat.id ? "bg-ink text-paper ring-ink" : "bg-paper text-ink ring-border",
            )}
          >
            {cat.label}
          </Link>
        ))}
      </div>
      {products.length === 0 ? (
        <p className="mt-16 text-sm text-muted">Nothing on this shelf yet.</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}
