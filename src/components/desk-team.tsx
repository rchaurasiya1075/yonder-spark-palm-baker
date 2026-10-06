import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACCESS,
  createDeskAccount,
  removeDeskAccount,
  watchDeskAccounts,
  type AccessId,
  type DeskAccount,
} from "@/lib/desk-accounts";

export function DeskTeam() {
  const [accounts, setAccounts] = useState<DeskAccount[]>([]);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [access, setAccess] = useState<AccessId[]>(["chat"]);
  const [busy, setBusy] = useState(false);

  useEffect(() => watchDeskAccounts(setAccounts), []);

  function toggle(key: AccessId) {
    setAccess((curr) => (curr.includes(key) ? curr.filter((item) => item !== key) : [...curr, key]));
  }

  async function create() {
    setBusy(true);
    try {
      await createDeskAccount({ id, name, pin, role, access });
      setName("");
      setId("");
      setPin("");
      setAccess(["chat"]);
      toast.success("Login save ho gaya.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login save nahi hua.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl text-white">
      <h2 className="text-2xl font-semibold">Admin / employee login</h2>
      <p className="mt-2 text-sm text-white/60">
        Owner id se andar aane ke baad yahan naya user id aur pin banta hai. Admin ko saara access milta hai. Employee ko sirf jo tick karoge.
      </p>
      <p className="mt-2 text-sm text-white/80">Login page: /support-login</p>
      <div className="mt-5 grid gap-2">
        <Input value={name} placeholder="Naam" onChange={(e) => setName(e.target.value)} />
        <Input value={id} placeholder="User id" onChange={(e) => setId(e.target.value)} />
        <Input value={pin} type="password" placeholder="Pin" onChange={(e) => setPin(e.target.value)} />
        <div className="flex gap-2 text-sm">
          {(["employee", "admin"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setRole(item)} className={`rounded-full px-3 py-1 ${role === item ? "bg-[#00a884]" : "bg-white/10"}`}>
              {item}
            </button>
          ))}
        </div>
        {role === "employee" && (
          <div className="grid gap-1 text-sm">
            {ACCESS.map((item) => (
              <label key={item.id} className="flex items-center gap-2">
                <input type="checkbox" checked={access.includes(item.id)} onChange={() => toggle(item.id)} />
                {item.label}
              </label>
            ))}
          </div>
        )}
        <Button type="button" disabled={busy} onClick={() => void create()}>
          {busy ? "Saving…" : "Create login"}
        </Button>
      </div>
      <ul className="mt-6 divide-y divide-white/10">
        {accounts.map((row) => (
          <li key={row.id} className="flex items-center justify-between py-3 text-sm">
            <span>
              <span className="block font-medium">{row.name}</span>
              <span className="text-white/50">{row.id} · {row.role} · {row.role === "admin" ? "full access" : row.access.join(", ") || "no access"}</span>
            </span>
            <button type="button" className="text-xs text-red-300" onClick={() => void removeDeskAccount(row.id).catch((err) => toast.error(err instanceof Error ? err.message : "Remove nahi hua."))}>
              Remove
            </button>
          </li>
        ))}
        {!accounts.length && <li className="py-3 text-sm text-white/50">Abhi koi extra login nahi hai.</li>}
      </ul>
    </section>
  );
}
