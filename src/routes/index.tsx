import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Leaf, ShieldCheck, Sprout, Wheat } from "lucide-react";
import { CATEGORIES, SITE } from "@/lib/constants";
import { loadProducts } from "@/lib/catalog-client";
import { publicUrl } from "@/lib/public-url";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  loader: () => loadProducts(),
  component: Home,
});

function Home() {
  const products = Route.useLoaderData();
  const featured = products.filter((p) => p.featured).slice(0, 3);
  const rest = featured.length ? featured : products.slice(0, 3);

  return (
    <main>
      <section className="relative min-h-[78vh] overflow-hidden">
        <img
          src={publicUrl("images/hero-farm.jpg")}
          alt="Mustard fields at PINAKI Farms"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/35 to-ink/15" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.22em] text-paper/80 uppercase">
            From our farm kitchen
          </p>
          <h1 className="mt-3 max-w-xl font-display text-4xl font-semibold text-paper sm:text-6xl">
            {SITE.name}
          </h1>
          <p className="mt-3 max-w-lg font-display text-xl text-paper/90 sm:text-2xl">
            {SITE.tagline}
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-paper/80">
            Homemade achar, A2 bilona ghee, and wooden-kolhu oils — packed in small
            batches, the way ghar ka khana has always been made.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/shop">
                Shop the pantry <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-paper/40 bg-paper/10 text-paper hover:bg-paper/20">
              <Link to="/shop" search={{ category: "ghee" }}>
                A2 Bilona Ghee
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
              The pantry
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold">Shop by category</h2>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              to="/shop"
              search={{ category: cat.id }}
              className="rounded-xl bg-paper p-6 ring-1 ring-border transition-shadow hover:shadow-[var(--shadow-card)]"
            >
              <p className="text-xs text-muted">{cat.hindi}</p>
              <h3 className="mt-1 font-display text-2xl font-semibold">{cat.label}</h3>
              <p className="mt-2 text-sm text-muted">{cat.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                Browse <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
              From this week’s kitchen
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold">Farm favourites</h2>
          </div>
          <Link to="/shop" className="hidden text-sm font-semibold text-accent sm:inline">
            View all
          </Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-xl bg-paper px-6 py-10 ring-1 ring-border sm:px-10">
          <h2 className="font-display text-3xl font-semibold">Why PINAKI</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Wheat,
                title: "Bilona A2 ghee",
                body: "Cultured desi cow milk, hand-churned, slow-cooked in a kadai.",
              },
              {
                icon: Sprout,
                title: "Wooden kolhu oils",
                body: "Mustard, sesame and coconut crushed without heat.",
              },
              {
                icon: Leaf,
                title: "Ghar ka achar",
                body: "Mango, stuffed chili and mixed pickles, sun-cured in-house.",
              },
              {
                icon: ShieldCheck,
                title: "FSSAI licensed",
                body: `License No. ${SITE.fssai} · honest labels, honest jars.`,
              },
            ].map((item) => (
              <div key={item.title}>
                <item.icon className="size-6 text-accent" strokeWidth={1.6} />
                <h3 className="mt-3 font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
