import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, ShoppingBag, X } from "lucide-react";
import { SITE } from "@/lib/constants";
import { cartCount, useCart } from "@/lib/cart";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/shop" as const, label: "Shop", search: { category: undefined as undefined } },
  { to: "/shop" as const, label: "Achar", search: { category: "achar" as const } },
  { to: "/shop" as const, label: "Ghee", search: { category: "ghee" as const } },
  { to: "/shop" as const, label: "Oils", search: { category: "oil" as const } },
];

function LogoMark() {
  return (
    <span className="grid size-9 place-items-center rounded-md bg-accent text-paper">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <rect x="8" y="3" width="8" height="2.2" rx="0.6" fill="currentColor" />
        <rect x="9.5" y="5.2" width="5" height="2" fill="#F4EFE4" opacity="0.85" />
        <rect x="6.5" y="7.2" width="11" height="12.5" rx="2.2" fill="currentColor" />
      </svg>
    </span>
  );
}

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  const [signingOut, setSigningOut] = useState(false);
  if (isPending) {
    return <div className="h-9 w-20 animate-pulse rounded-full bg-ink/10" />;
  }
  if (!user) {
    return (
      <Link
        to="/login"
        className="inline-flex h-11 items-center px-2 text-sm font-semibold text-ink"
      >
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Link
        to="/account"
        className="inline-flex h-11 max-w-32 items-center truncate px-2 text-sm font-semibold text-ink"
      >
        {user.displayName?.split(" ")[0] ?? "Account"}
      </Link>
      <button
        type="button"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true);
          void signOut("/").catch(() => setSigningOut(false));
        }}
        className="hidden h-11 px-2 text-sm text-muted hover:text-ink sm:inline"
      >
        {signingOut ? "…" : "Sign out"}
      </button>
    </div>
  );
}

export function SiteHeader() {
  const items = useCart((s) => s.items);
  const count = cartCount(items);
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-cream/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <LogoMark />
          <span className="min-w-0">
            <span className="block font-display text-lg leading-none font-semibold tracking-tight">
              {SITE.name}
            </span>
            <span className="hidden truncate text-[11px] text-muted sm:block">
              {SITE.tagline}
            </span>
          </span>
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              search={item.search}
              className="rounded-full px-3 py-2 text-sm font-medium text-ink/80 hover:bg-ink/5 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <AuthSlot />
          <Link
            to="/cart"
            className="relative grid size-11 place-items-center rounded-full hover:bg-ink/5"
            aria-label="Cart"
          >
            <ShoppingBag className="size-5" />
            {count > 0 ? (
              <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-paper">
                {count}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full hover:bg-ink/5 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <div
        className={cn(
          "border-t border-border bg-cream md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="mx-auto flex max-w-6xl flex-col px-2 py-2">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              search={item.search}
              onClick={() => setOpen(false)}
              className="flex h-12 items-center px-3 text-sm font-medium"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/account"
            onClick={() => setOpen(false)}
            className="flex h-12 items-center px-3 text-sm font-medium"
          >
            My account
          </Link>
        </nav>
      </div>
    </header>
  );
}
