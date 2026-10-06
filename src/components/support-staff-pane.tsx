import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupportAgent, removeSupportAgent, watchSupportStaff, type SupportAgent } from "@/lib/support-staff";

export function SupportStaffPane() {
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => watchSupportStaff(setAgents), []);

  async function create() {
    setBusy(true);
    try {
      await createSupportAgent({ id, name, password });
      setName("");
      setId("");
      setPassword("");
      toast.success("Support login saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the login.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 max-w-md">
      <h2 className="font-display text-2xl font-semibold">Support employee login</h2>
      <p className="mt-2 text-sm text-muted">
        Employee sirf customer support desk khol sakta hai. Admin panel nahi.
      </p>
      <p className="mt-2 text-sm">Login link: /support-login</p>
      <div className="mt-5 grid gap-2">
        <Input value={name} placeholder="Employee name" onChange={(e) => setName(e.target.value)} />
        <Input value={id} placeholder="User id" onChange={(e) => setId(e.target.value)} />
        <Input value={password} type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
        <Button type="button" disabled={busy} onClick={() => void create()}>
          {busy ? "Saving…" : "Create login"}
        </Button>
      </div>
      <ul className="mt-6 divide-y divide-border">
        {agents.map((row) => (
          <li key={row.id} className="flex items-center justify-between py-3 text-sm">
            <span>
              <span className="block font-medium">{row.name}</span>
              <span className="text-muted">{row.id}</span>
            </span>
            <button type="button" className="text-xs text-accent" onClick={() => void removeSupportAgent(row.id).catch((err) => toast.error(err instanceof Error ? err.message : "Could not remove."))}>
              Remove
            </button>
          </li>
        ))}
        {!agents.length && <li className="py-3 text-sm text-muted">No support employees yet.</li>}
      </ul>
    </div>
  );
}
