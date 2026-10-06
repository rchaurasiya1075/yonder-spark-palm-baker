import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getVisitorId,
  listenMessages,
  sendCustomerMessage,
  threadIdFor,
  type SupportMessage,
} from "@/lib/support-chat";

const OPEN_EVENT = "pinaki-open-support";

export function openSupportChat() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [draft, setDraft] = useState("");
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const visitorId = typeof window === "undefined" ? "" : getVisitorId();

  useEffect(() => {
    const saved = localStorage.getItem("pinaki-support-name");
    const savedPhone = localStorage.getItem("pinaki-support-phone");
    if (saved) setName(saved);
    if (savedPhone) setPhone(savedPhone);
    if (localStorage.getItem("pinaki-support-started") === "1") setStarted(true);
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!started || !visitorId) return;
    return listenMessages(threadIdFor(visitorId), setMessages);
  }, [started, visitorId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  async function send(text: string) {
    const body = text.trim();
    if (!body || !name.trim()) return;
    setBusy(true);
    try {
      localStorage.setItem("pinaki-support-name", name.trim());
      localStorage.setItem("pinaki-support-phone", phone.trim());
      localStorage.setItem("pinaki-support-started", "1");
      setStarted(true);
      await sendCustomerMessage({
        visitorId,
        customerName: name.trim(),
        phone,
        text: body,
      });
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message nahi gaya. Dubara try karo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper shadow-lg ring-1 ring-ink"
        aria-expanded={open}
      >
        <span aria-hidden>💬</span>
        Chat support
      </button>
      {open ? (
        <section className="fixed bottom-20 right-4 z-40 flex h-[min(34rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-paper shadow-2xl ring-1 ring-border">
          <header className="flex items-center justify-between bg-ink px-4 py-3 text-paper">
            <div>
              <p className="font-display text-lg font-semibold">PINAKI support</p>
              <p className="text-xs text-paper/70">Order, delivery, ya product — yahin poochho</p>
            </div>
            <button type="button" className="text-sm font-semibold" onClick={() => setOpen(false)}>
              Close
            </button>
          </header>
          {!started ? (
            <form
              className="flex flex-1 flex-col gap-3 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft || "Namaste, mujhe help chahiye.");
              }}
            >
              <p className="text-sm text-muted">Naam likho, phir message bhejo. Team owner desk pe reply karegi.</p>
              <Input
                placeholder="Aapka naam"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                placeholder="Mobile (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
              />
              <textarea
                className="min-h-24 flex-1 rounded-md border border-border bg-cream px-3 py-2 text-sm"
                placeholder="Order ID, product, ya sawal likho"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                required
              />
              <Button type="submit" disabled={busy}>
                {busy ? "Bhej rahe hain…" : "Chat shuru karo"}
              </Button>
            </form>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto bg-cream p-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted">Namaste {name}. Message bhejo, hum yahin reply karenge.</p>
                ) : null}
                {messages.map((m) => (
                  <p
                    key={m.id}
                    className={
                      m.from === "customer"
                        ? "ml-8 rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-sm text-paper"
                        : "mr-8 rounded-2xl rounded-bl-sm bg-paper px-3 py-2 text-sm text-ink ring-1 ring-border"
                    }
                  >
                    {m.text}
                  </p>
                ))}
                <div ref={endRef} />
              </div>
              <form
                className="flex gap-2 border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(draft);
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message"
                  aria-label="Message"
                />
                <Button type="submit" disabled={busy || !draft.trim()}>
                  Send
                </Button>
              </form>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
