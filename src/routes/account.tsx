import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatDate, formatInr } from "@/lib/format";
import { firebaseChangePassword, firebaseUpdateDisplayName, getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { fbListMyOrders } from "@/lib/firebase-data";
import { emptyAddress, fbGetShopUser, fbSaveShopUser } from "@/lib/firebase-users";
import { listMyOrders } from "@/lib/server/orders";
import { isValidPhone, isValidUsername, normalizePhone, normalizeUsername } from "@/lib/identity";
import { MAX_ADDRESSES, STATUS_LABEL, type Order, type SavedAddress, type ShopUser } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OrderTracker } from "@/components/order-tracker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

type Tab = "profile" | "addresses" | "security" | "orders";

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("profile");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ShopUser | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fbUser = getFirebaseCurrentUser();
    if (fbUser) {
      fbGetShopUser(fbUser.uid)
        .then((row) => {
          if (!cancelled) setProfile(row);
        })
        .catch(() => {
          if (!cancelled) setProfile(null);
        });
    }
    const load = fbUser
      ? fbListMyOrders(fbUser.uid, fbUser.email)
      : import.meta.env.VITE_GITHUB_PAGES === "1"
        ? Promise.resolve([])
        : listMyOrders();
    load
      .then((rows) => {
        if (!cancelled) setOrders(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load orders");
          setOrders([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (isPending) {
    return <main className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted">Loading account…</main>;
  }
  if (!user) return <RedirectToSignIn />;

  const greet = profile?.firstName || user.displayName?.split(" ")[0] || "";
  const payments = (orders ?? []).map((o) => ({
    id: o.id,
    date: o.createdAt,
    method: o.paymentMethod === "cod" ? "Cash on delivery" : "Online",
    status: o.paymentStatus,
    total: o.total,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        My dashboard
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold">
            Namaste{greet ? `, ${greet}` : ""}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {user.primaryEmail}
            {profile?.username ? ` · @${profile.username}` : ""}
            {profile?.phone ? ` · ${profile.phone}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-muted hover:text-ink"
          onClick={() => void signOut("/")}
        >
          Sign out
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["profile", "Profile"],
            ["addresses", `Addresses (${profile?.addresses.length ?? 0}/${MAX_ADDRESSES})`],
            ["security", "Password"],
            ["orders", `Orders (${orders?.length ?? 0})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "h-11 rounded-full px-4 text-sm font-semibold ring-1",
              tab === id ? "bg-ink text-paper ring-ink" : "bg-paper text-ink ring-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <ProfileDesk
          userId={user.id}
          email={user.primaryEmail ?? ""}
          displayName={user.displayName}
          profile={profile}
          onSaved={setProfile}
        />
      ) : null}
      {tab === "addresses" ? (
        <AddressDesk
          userId={user.id}
          email={user.primaryEmail ?? ""}
          profile={profile}
          onSaved={setProfile}
        />
      ) : null}
      {tab === "security" ? <PasswordDesk email={user.primaryEmail} /> : null}
      {tab === "orders" ? (
        <OrdersDesk orders={orders} payments={payments} error={error} />
      ) : null}
    </main>
  );
}

function ProfileDesk({
  userId,
  email,
  displayName,
  profile,
  onSaved,
}: {
  userId: string;
  email: string;
  displayName: string | null;
  profile: ShopUser | null;
  onSaved: (row: ShopUser) => void;
}) {
  const [firstName, setFirstName] = useState(profile?.firstName ?? displayName?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(
    profile?.lastName ?? displayName?.split(" ").slice(1).join(" ") ?? "",
  );
  const [username, setUsername] = useState(profile?.username ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName || displayName?.split(" ")[0] || "");
    setLastName(profile.lastName || displayName?.split(" ").slice(1).join(" ") || "");
    setUsername(profile.username);
    setPhone(profile.phone);
  }, [profile, displayName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fbUser = getFirebaseCurrentUser();
    if (!fbUser || !email) {
      toast.error("Please sign in again to update your profile.");
      return;
    }
    const nextUser = normalizeUsername(username);
    const nextPhone = normalizePhone(phone);
    if (!isValidUsername(nextUser)) {
      toast.error("Username should start with a letter and use 3–20 letters, numbers, or _.");
      return;
    }
    if (!isValidPhone(nextPhone)) {
      toast.error("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    try {
      const saved = await fbSaveShopUser({
        userId: fbUser.uid || userId,
        email,
        username: nextUser,
        firstName,
        lastName,
        phone: nextPhone,
        addresses: profile?.addresses ?? [],
      });
      await firebaseUpdateDisplayName(saved.name);
      onSaved(saved);
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-xl space-y-4 rounded-xl bg-paper p-6 ring-1 ring-border">
      <h2 className="font-display text-2xl font-semibold">Profile</h2>
      <p className="text-sm text-muted">
        Update your name, username, and mobile. You can sign in with username, mobile, or Gmail.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="first">First name</Label>
          <Input
            id="first"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last">Last name</Label>
          <Input
            id="last"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Mobile</Label>
        <Input
          id="phone"
          inputMode="numeric"
          maxLength={10}
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Gmail / email</Label>
        <Input id="email" value={email} disabled />
        <p className="text-xs text-muted">Email is used for login and password reset. It cannot be changed here.</p>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

function AddressDesk({
  userId,
  email,
  profile,
  onSaved,
}: {
  userId: string;
  email: string;
  profile: ShopUser | null;
  onSaved: (row: ShopUser) => void;
}) {
  const addresses = profile?.addresses ?? [];
  const [draft, setDraft] = useState<SavedAddress | null>(null);
  const [busy, setBusy] = useState(false);

  async function persist(next: SavedAddress[]) {
    const fbUser = getFirebaseCurrentUser();
    if (!fbUser || !email) {
      throw new Error("Please sign in again to save addresses.");
    }
    const saved = await fbSaveShopUser({
      userId: fbUser.uid || userId,
      email,
      username: profile?.username ?? "",
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      phone: profile?.phone ?? "",
      addresses: next,
    });
    onSaved(saved);
    return saved;
  }

  function startAdd() {
    if (addresses.length >= MAX_ADDRESSES) {
      toast.error("You can save up to 5 addresses.");
      return;
    }
    setDraft({
      ...emptyAddress(profile?.name ?? "", profile?.phone ?? ""),
      label: addresses.length === 0 ? "Home" : addresses.length === 1 ? "Work" : `Address ${addresses.length + 1}`,
      isDefault: addresses.length === 0,
    });
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (draft.pincode && draft.pincode.length !== 6) {
      toast.error("Pincode should be 6 digits.");
      return;
    }
    if (draft.phone && !isValidPhone(draft.phone)) {
      toast.error("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    try {
      let next = addresses.filter((a) => a.id !== draft.id);
      const row = { ...draft, phone: normalizePhone(draft.phone) };
      if (row.isDefault) next = next.map((a) => ({ ...a, isDefault: false }));
      next = [...next, row];
      if (!next.some((a) => a.isDefault) && next[0]) next[0] = { ...next[0], isDefault: true };
      await persist(next);
      setDraft(null);
      toast.success("Address saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save address");
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(id: string) {
    setBusy(true);
    try {
      let next = addresses.filter((a) => a.id !== id);
      if (next.length && !next.some((a) => a.isDefault)) next = next.map((a, i) => ({ ...a, isDefault: i === 0 }));
      await persist(next);
      if (draft?.id === id) setDraft(null);
      toast.success("Address removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove address");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Saved addresses</h2>
          <p className="mt-1 text-sm text-muted">Keep up to 5 addresses for faster checkout.</p>
        </div>
        <Button type="button" variant="outline" onClick={startAdd} disabled={busy || addresses.length >= MAX_ADDRESSES}>
          Add address
        </Button>
      </div>
      {addresses.length === 0 && !draft ? (
        <div className="rounded-xl bg-paper p-8 ring-1 ring-border">
          <p className="text-sm text-muted">No addresses yet. Add home, work, or a family address.</p>
        </div>
      ) : null}
      <ul className="space-y-3">
        {addresses.map((addr) => (
          <li key={addr.id} className="rounded-xl bg-paper p-5 ring-1 ring-border">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {addr.label || "Address"}
                  {addr.isDefault ? (
                    <span className="ml-2 text-xs font-medium text-forest">Default</span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm">
                  {addr.name} {addr.phone ? `· ${addr.phone}` : ""}
                </p>
                <p className="text-sm text-muted">
                  {addr.address}, {addr.city} {addr.pincode}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft(addr)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void removeAddress(addr.id)}>
                  Remove
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {draft ? (
        <form onSubmit={saveDraft} className="max-w-xl space-y-3 rounded-xl bg-paper p-5 ring-1 ring-border">
          <h3 className="font-display text-xl font-semibold">
            {addresses.some((a) => a.id === draft.id) ? "Edit address" : "New address"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="alabel">Label</Label>
              <Input
                id="alabel"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Home, Work, Parents"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aname">Full name</Label>
              <Input
                id="aname"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aphone">Mobile</Label>
              <Input
                id="aphone"
                inputMode="numeric"
                maxLength={10}
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apin">Pincode</Label>
              <Input
                id="apin"
                inputMode="numeric"
                maxLength={6}
                value={draft.pincode}
                onChange={(e) => setDraft({ ...draft, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="aaddr">Address</Label>
              <Textarea
                id="aaddr"
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="acity">City</Label>
              <Input
                id="acity"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                required
              />
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(draft.isDefault)}
              onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
            />
            Use as default at checkout
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save address"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function PasswordDesk({ email }: { email: string | null }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("New password should be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await firebaseChangePassword(current, next);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update password.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 max-w-xl space-y-4">
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-paper p-6 ring-1 ring-border">
        <h2 className="font-display text-2xl font-semibold">Change password</h2>
        <p className="text-sm text-muted">
          Enter your current password, then choose a new one. Reset email goes to {email ?? "your Gmail"}.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="cur">Current password</Label>
          <Input
            id="cur"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newp">New password</Label>
          <Input
            id="newp"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conf">Confirm new password</Label>
          <Input
            id="conf"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
      <p className="text-sm text-muted">
        Forgot the current password?{" "}
        <Link to="/forgot-password" className="font-semibold text-accent">
          Send a reset link
        </Link>
      </p>
    </section>
  );
}

function OrdersDesk({
  orders,
  payments,
  error,
}: {
  orders: Order[] | null;
  payments: { id: string; date: string; method: string; status: string; total: number }[];
  error: string | null;
}) {
  return (
    <>
      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">Orders</h2>
        {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
        {orders == null ? (
          <p className="mt-4 text-sm text-muted">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="mt-4 rounded-xl bg-paper p-8 ring-1 ring-border">
            <p className="text-sm text-muted">No orders yet.</p>
            <Link to="/shop" className="mt-3 inline-block text-sm font-semibold text-accent">
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl bg-paper p-5 ring-1 ring-border">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: order.id }}
                      className="font-semibold hover:underline"
                    >
                      {order.id}
                    </Link>
                    <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                  </div>
                  <Badge tone={order.orderStatus === "cancelled" ? "accent" : "forest"}>
                    {STATUS_LABEL[order.orderStatus]}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {order.items.map((i) => `${i.productName} × ${i.quantity}`).join(" · ")}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {formatInr(order.total)}
                  {order.couponCode ? (
                    <span className="ml-2 text-xs font-medium text-forest">
                      {order.couponCode} applied
                    </span>
                  ) : null}
                </p>
                <div className="mt-4">
                  <OrderTracker status={order.orderStatus} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No payments yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl bg-paper ring-1 ring-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to="/orders/$orderId"
                        params={{ orderId: p.id }}
                        className="font-medium hover:underline"
                      >
                        {p.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(p.date)}</td>
                    <td className="px-4 py-3">{p.method}</td>
                    <td className="px-4 py-3 capitalize">{p.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInr(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
