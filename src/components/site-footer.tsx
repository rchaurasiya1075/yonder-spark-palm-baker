import { Link } from "@tanstack/react-router";
import { SITE } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-display text-xl font-semibold">{SITE.name}</p>
          <p className="mt-2 text-sm text-paper/70">{SITE.tagline}</p>
          <p className="mt-4 text-sm text-paper/70">{SITE.address}</p>
          <p className="mt-2 text-xs tracking-wide text-paper/55">
            FSSAI License No. {SITE.fssai}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-paper/50 uppercase">
            Shop
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/shop" search={{ category: "achar" }} className="hover:underline">
                Achar
              </Link>
            </li>
            <li>
              <Link to="/shop" search={{ category: "ghee" }} className="hover:underline">
                A2 Desi Ghee
              </Link>
            </li>
            <li>
              <Link to="/shop" search={{ category: "oil" }} className="hover:underline">
                Cold Pressed Oils
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-paper/50 uppercase">
            Help
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/account" className="hover:underline">
                My account
              </Link>
            </li>
            <li>
              <Link to="/cart" className="hover:underline">
                Cart
              </Link>
            </li>
            <li className="pt-4">
              <Link
                to="/admin"
                className="text-xs text-paper/40 hover:text-paper/70 hover:underline"
              >
                Store owner
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-paper/10 py-4 text-center text-xs text-paper/40">
        Homemade in small batches. No shortcuts.
      </div>
    </footer>
  );
}
