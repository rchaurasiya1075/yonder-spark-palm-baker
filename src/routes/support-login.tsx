import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginDesk } from "@/lib/desk-accounts";

export const Route = createFileRoute("/support-login")({
  component: SupportLoginPage,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});

function SupportLoginPage() {
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setBusy(true);
    try {
      await loginDesk(id, pin);
      await navigate({ to: "/support-desk" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#07080a] px-4 text-white">
      <form className="w-full max-w-sm" onSubmit={(e) => void submit(e)}>
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">PINAKI Farms</p>
        <h1 className="mt-2 text-3xl font-semibold">Desk sign in</h1>
        <p className="mt-3 text-sm text-white/60">Owner pehle apna user id aur pin daalta hai. Uske baad admin ya employee ka login yahin se banta hai.</p>
        <div className="mt-6 grid gap-2">
          <Input value={id} placeholder="User id" autoComplete="username" onChange={(e) => setId(e.target.value)} />
          <Input value={pin} type="password" placeholder="Pin" autoComplete="current-password" onChange={(e) => setPin(e.target.value)} />
          <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Enter"}</Button>
        </div>
      </form>
    </main>
  );
}
