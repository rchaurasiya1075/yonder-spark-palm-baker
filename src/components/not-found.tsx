import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
      <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">404</p>
      <h1 className="font-display text-3xl font-semibold text-ink">This page is not on the farm</h1>
      <p className="max-w-sm text-sm text-muted">
        The shelf you opened is empty. Head back to the shop for achar, ghee, and oils.
      </p>
      <Link
        to="/shop"
        className="mt-2 inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-paper"
      >
        Browse the shop
      </Link>
    </main>
  );
}
