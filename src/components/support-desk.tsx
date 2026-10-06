import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import {
  listenMessages,
  listenThreads,
  sendStaffReply,
  type SupportMessage,
  type SupportThread,
} from "@/lib/support-chat";

export function SupportDesk() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return listenThreads((rows) => {
      setError(null);
      setThreads(rows);
      setActiveId((current) => current ?? rows[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    return listenMessages(activeId, setMessages);
  }, [activeId]);

  const active = threads.find((t) => t.id === activeId) ?? null;

  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-2">
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        {threads.length === 0 ? (
          <p className="text-sm text-muted">Abhi koi customer chat nahi hai.</p>
        ) : null}
        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            onClick={() => setActiveId(thread.id)}
            className={
              thread.id === activeId
                ? "w-full rounded-xl bg-ink p-3 text-left text-paper"
                : "w-full rounded-xl bg-paper p-3 text-left ring-1 ring-border"
            }
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{thread.customerName}</span>
              {thread.unreadStaff > 0 ? (
                <span className="rounded-full bg-accent px-2 text-xs font-semibold text-paper">new</span>
              ) : null}
            </span>
            <span className="mt-1 block truncate text-xs opacity-70">{thread.lastMessage || "New chat"}</span>
          </button>
        ))}
      </aside>
      <section className="flex min-h-80 flex-col rounded-xl bg-paper ring-1 ring-border">
        {active ? (
          <>
            <header className="border-b border-border px-4 py-3">
              <p className="font-semibold">{active.customerName}</p>
              <p className="text-xs text-muted">
                {active.phone || "No mobile"} · {formatDateTime(new Date(active.updatedAt).toISOString())}
              </p>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto bg-cream p-4">
              {messages.map((m) => (
                <p
                  key={m.id}
                  className={
                    m.from === "staff"
                      ? "ml-10 rounded-2xl bg-ink px-3 py-2 text-sm text-paper"
                      : "mr-10 rounded-2xl bg-paper px-3 py-2 text-sm ring-1 ring-border"
                  }
                >
                  {m.text}
                </p>
              ))}
            </div>
            <form
              className="flex gap-2 border-t border-border p-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                setBusy(true);
                try {
                  await sendStaffReply(active.id, draft);
                  setDraft("");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Reply nahi gaya");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply to customer" />
              <Button type="submit" disabled={busy || !draft.trim()}>
                Reply
              </Button>
            </form>
          </>
        ) : (
          <p className="p-6 text-sm text-muted">Customer chat yahan dikhega.</p>
        )}
      </section>
    </div>
  );
}
