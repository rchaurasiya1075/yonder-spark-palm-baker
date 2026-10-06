import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  markCustomerSeen,
  markSupportRead,
  replySupport,
  saveSupportNote,
  sendSupport,
  setAdminTyping,
  setCustomerTyping,
  setSupportStatus,
  shrinkImage,
  watchMySupport,
  watchSupportThreads,
  type SupportLine,
  type SupportThread,
} from "@/lib/support-chat";

const REPLIES = [
  { key: "/noted", text: "Aapki baat note ho gayi. Hum check kar rahe hain." },
  { key: "/order", text: "Order status check kar rahe hain. Thodi der mein update denge." },
  { key: "/dispatch", text: "Order pack ho gaya hai aur dispatch ke liye ready hai." },
  { key: "/photo", text: "Please jar ya order ki photo bhej dijiye." },
];

function clock(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const that = new Date(date);
  that.setHours(0, 0, 0, 0);
  const diff = (start.getTime() - that.getTime()) / 86_400_000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => void ctx.close();
  } catch {
    /* sound is optional */
  }
}

function Bubbles({
  lines,
  mine,
  seen,
}: {
  lines: SupportLine[];
  mine: "user" | "admin";
  seen?: string;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines]);
  let lastDay = "";
  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#efe7dc] px-3 py-3">
      {lines.length === 0 && <p className="pt-8 text-center text-sm text-[#6d6256]">Abhi koi message nahi.</p>}
      {lines.map((line) => {
        const day = dayLabel(line.at);
        const showDay = day && day !== lastDay;
        lastDay = day;
        const own = line.from === mine;
        const read = !!seen && line.at <= seen;
        return (
          <div key={line.id}>
            {showDay && <p className="mx-auto my-2 w-fit rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-[#6d6256]">{day}</p>}
            <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${own ? "ml-auto rounded-br-md bg-[#1f6b4a] text-white" : "rounded-bl-md bg-white text-[#231c16]"}`}>
              {line.text && <p className="whitespace-pre-wrap leading-5">{line.text}</p>}
              {line.image && <img src={line.image} alt="Shared" className="mt-1 max-h-52 rounded-lg" />}
              <p className={`mt-1 text-right text-[10px] ${own ? "text-[#6d6256]" : "text-[#8a7d70]"}`}>
                {clock(line.at)}
                {own && <span className={read ? "text-[#b7e4ff]" : ""}> ✓✓</span>}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function Composer({
  placeholder,
  onSend,
  onType,
}: {
  placeholder: string;
  onSend: (text: string, image?: string) => Promise<void>;
  onType?: (typing: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const typeRef = useRef(onType);
  typeRef.current = onType;
  const quick = text.startsWith("/") ? REPLIES.filter((row) => row.key.startsWith(text.split(" ")[0] || "/")) : [];
  useEffect(() => {
    typeRef.current?.(!!text.trim());
    if (!text.trim()) return;
    const id = window.setInterval(() => typeRef.current?.(true), 4000);
    return () => window.clearInterval(id);
  }, [text]);

  async function send(next = text) {
    if (busy || (!next.trim() && !image)) return;
    setBusy(true);
    onType?.(false);
    try {
      await onSend(next, image || undefined);
      setText("");
      setImage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message nahi gaya.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-black/5 bg-[#f7f1e8] px-2 py-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
      {quick.length > 0 && (
        <div className="mb-2 overflow-hidden rounded-xl bg-white">
          {quick.map((row) => (
            <button key={row.key} type="button" className="block w-full px-3 py-2 text-left text-sm text-[#231c16] hover:bg-black/5" onClick={() => void send(row.text)}>
              <span className="font-semibold text-[#1f6b4a]">{row.key}</span> {row.text}
            </button>
          ))}
        </div>
      )}
      {image && <img src={image} alt="Ready to send" className="mb-2 h-14 rounded-lg" />}
      <div className="flex items-end gap-2">
        <button type="button" className="grid size-11 place-items-center rounded-full text-lg text-[#6d6256]" onClick={() => file.current?.click()} aria-label="Photo">
          +
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            if (!picked) return;
            void shrinkImage(picked).then(setImage).catch((err) => toast.error(err instanceof Error ? err.message : "Photo nahi lagi"));
          }}
        />
        <textarea
          value={text}
          rows={1}
          placeholder={placeholder}
          enterKeyHint="send"
          className="max-h-24 min-h-11 flex-1 resize-none rounded-2xl bg-white px-3 py-2.5 text-base text-[#231c16] outline-none ring-1 ring-black/10"
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => {
            const node = e.currentTarget;
            window.setTimeout(() => node.scrollIntoView({ block: "end", behavior: "smooth" }), 180);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" disabled={busy} className="grid size-11 place-items-center rounded-full bg-[#1f6b4a] text-white disabled:opacity-50" onClick={() => void send()} aria-label="Send">
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function SupportInbox() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "pending" | "resolved">("all");
  const [note, setNote] = useState("");
  const [info, setInfo] = useState(false);
  const heard = useRef(0);
  useEffect(() => watchSupportThreads(setThreads), []);
  useEffect(() => {
    const unread = threads.reduce((sum, row) => sum + row.unread, 0);
    if (heard.current && unread > heard.current) beep();
    heard.current = unread;
  }, [threads]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((row) => {
      if (filter === "unread" && row.unread < 1) return false;
      if (filter === "pending" && row.status !== "pending") return false;
      if (filter === "resolved" && row.status !== "resolved") return false;
      if (!q) return true;
      const last = row.lines.at(-1)?.text || "";
      return `${row.name} ${row.email} ${row.phone} ${last}`.toLowerCase().includes(q);
    });
  }, [threads, query, filter]);
  const thread = threads.find((row) => row.userId === open) || null;

  useEffect(() => {
    if (!thread) return;
    setNote(thread.note);
  }, [thread?.userId]);
  useEffect(() => {
    if (!thread || thread.unread < 1) return;
    void markSupportRead(thread.userId).catch(() => undefined);
  }, [thread?.userId, thread?.unread]);

  return (
    <div className="grid h-full min-h-0 overflow-hidden rounded-xl border border-black/10 bg-[#f7f1e8] text-[#231c16] lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className={`${thread ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-r border-black/10`}>
        <div className="border-b border-black/10 p-3">
          <p className="text-sm font-semibold">Customer support</p>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, email" className="mt-2 h-9 w-full rounded-lg bg-white px-3 text-sm outline-none" />
          <div className="mt-2 flex gap-1 text-[11px]">
            {(["all", "unread", "pending", "resolved"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-full px-2 py-1 capitalize ${filter === id ? "bg-[#1f6b4a] text-white" : "bg-white/5 text-[#6d6256]"}`}>
                {id}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {shown.map((row) => {
            const last = row.lines.at(-1);
            return (
              <li key={row.userId}>
                <button type="button" onClick={() => setOpen(row.userId)} className={`flex w-full gap-3 border-b border-white/5 px-3 py-3 text-left ${thread?.userId === row.userId ? "bg-[#efe7dc]" : "hover:bg-black/5"}`}>
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-[#1f6b4a] text-sm font-semibold">
                    {(row.name || "U").slice(0, 1).toUpperCase()}
                    <span className={`absolute bottom-0 right-0 size-2.5 rounded-full border border-[#111b21] ${row.typing || Date.now() - new Date(last?.at || 0).getTime() < 120_000 ? "bg-[#00d26a]" : "bg-white/30"}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{row.name}</span>
                      <span className="shrink-0 text-[10px] text-[#8a7d70]">{clock(last?.at || "")}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-[#6d6256]">{row.typing ? "typing…" : last?.image && !last.text ? "Photo" : last?.text}</span>
                      {row.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-[#1f6b4a] px-1 text-[10px]">{row.unread}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="px-3 py-6 text-sm text-[#6d6256]">No complaints in this filter.</li>}
        </ul>
      </aside>

      <section className={`${thread ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col`}>
        {!thread && <div className="grid flex-1 place-items-center text-sm text-[#6d6256]">Select a customer</div>}
        {thread && (
          <>
            <header className="flex items-center gap-3 border-b border-black/10 bg-white px-3 py-2">
              <button type="button" className="text-sm text-[#6d6256] lg:hidden" onClick={() => setOpen(null)}>Back</button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{thread.name}</p>
                <p className="text-[11px] text-[#6d6256]">{thread.typing ? "typing…" : thread.phone || thread.email || "Offline"}</p>
              </div>
              <button type="button" className="rounded-full bg-[#efe7dc] px-2 py-1 text-[11px]" onClick={() => void setSupportStatus(thread.userId, thread.status === "resolved" ? "pending" : "resolved")}>
                {thread.status === "resolved" ? "Resolved" : "Mark resolved"}
              </button>
              <button type="button" className="text-xs text-[#6d6256] xl:hidden" onClick={() => setInfo((v) => !v)}>Info</button>
            </header>
            {thread.status === "resolved" && <p className="bg-[#182229] py-1 text-center text-[11px] text-[#6d6256]">Marked resolved</p>}
            <Bubbles lines={thread.lines} mine="admin" seen={thread.customerSeen} />
            <Composer
              placeholder="Write a solution, or / for quick replies"
              onType={(typing) => void setAdminTyping(thread.userId, typing).catch(() => undefined)}
              onSend={(text, image) => replySupport(thread.userId, text, image)}
            />
          </>
        )}
      </section>

      {thread && (
        <aside className={`${info ? "flex" : "hidden"} min-h-0 flex-col gap-4 overflow-y-auto border-l border-black/10 bg-[#111b21] p-4 xl:flex`}>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Customer</p>
            <p className="mt-2 text-base font-medium">{thread.name}</p>
            <p className="mt-1 text-sm text-[#6d6256]">{thread.email || "No email"}</p>
            <p className="text-sm text-[#6d6256]">{thread.phone || "No phone"}</p>
            <p className="mt-1 text-xs text-white/40">Joined {thread.createdAt ? dayLabel(thread.createdAt) : "—"}</p>
            <p className="mt-1 text-xs text-white/40">Status {thread.status}</p>
          </div>
          <label className="block text-xs text-[#6d6256]">
            Internal note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-28 w-full rounded-lg bg-white p-2 text-sm text-white outline-none" placeholder="Only the admin team sees this" />
          </label>
          <button type="button" className="rounded-lg bg-[#1f6b4a] py-2 text-sm" onClick={() => void saveSupportNote(thread.userId, note).then(() => toast.success("Note saved")).catch((err) => toast.error(err instanceof Error ? err.message : "Note failed"))}>
            Save note
          </button>
        </aside>
      )}
    </div>
  );
}


const OPEN_EVENT = "pinaki-open-support";
export function openSupportChat() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function readFrame() {
  const vv = window.visualViewport;
  const narrow = window.innerWidth < 720;
  if (!vv) return { top: 0, height: window.innerHeight, narrow };
  return { top: vv.offsetTop, height: vv.height, narrow };
}

function useViewportFrame(active: boolean) {
  const [frame, setFrame] = useState({ top: 0, height: 640, narrow: false });
  useEffect(() => {
    if (!active) return;
    const sync = () => setFrame(readFrame());
    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.addEventListener("focusin", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("focusin", sync);
    };
  }, [active]);
  return frame;
}

export function SupportWidget() {
  const { user } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<SupportLine[]>([]);
  const [typing, setTyping] = useState(false);
  const [seen, setSeen] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ready, setReady] = useState(false);
  const frame = useViewportFrame(open);
  useEffect(() => {
    const saved = localStorage.getItem("pinaki-support-name") || user?.displayName || "";
    setName(saved);
    setPhone(localStorage.getItem("pinaki-support-phone") || "");
    setReady(Boolean(saved));
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [user?.displayName]);
  useEffect(() => watchMySupport(setLines, setTyping), [user?.id]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const at = new Date().toISOString();
    setSeen(at);
    void markCustomerSeen().catch(() => undefined);
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  const unread = lines.filter((line) => line.from === "admin" && line.at > seen).length;
  const panelStyle = frame.narrow
    ? { position: "fixed" as const, left: 0, right: 0, width: "100%", top: 0, height: frame.height, transform: `translate3d(0, ${frame.top}px, 0)`, borderRadius: 0, zIndex: 80 }
    : { position: "fixed" as const, right: 16, bottom: 24, width: 390, height: Math.min(620, frame.height - 48), zIndex: 80 };

  const tree = (
    <>
      {open && (
        <section
          className="flex flex-col overflow-hidden bg-[#efe6d6] text-[#3b2a22] shadow-2xl sm:rounded-2xl sm:ring-1 sm:ring-[#e4d8c8]"
          style={panelStyle}
        >
          <header className="flex shrink-0 items-center gap-3 bg-[#4a5d3f] px-3 py-3 text-[#fbf7f0]">
            <button type="button" className="grid size-9 place-items-center rounded-full hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-5" />
            </button>
            <span className="grid size-10 place-items-center rounded-full bg-[#f4efe4] text-sm font-semibold text-[#4a5d3f]">P</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">PINAKI Farms</p>
              <p className="text-[11px] text-[#f4efe4]/80">{typing ? "typing…" : "online"}</p>
            </div>
          </header>
          {!ready ? (
            <form
              className="flex flex-1 flex-col justify-end gap-3 bg-[#f4efe4] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                localStorage.setItem("pinaki-support-name", name.trim());
                localStorage.setItem("pinaki-support-phone", phone.trim());
                setReady(true);
              }}
            >
              <p className="text-sm text-[#7a6557]">Chat shuru karne ke liye naam likho. Jaise WhatsApp pe pehli baar name set hota hai.</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aapka naam" className="h-12 rounded-xl bg-white px-3 text-sm outline-none ring-1 ring-[#e4d8c8]" required />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile, optional" inputMode="tel" className="h-12 rounded-xl bg-white px-3 text-sm outline-none ring-1 ring-[#e4d8c8]" />
              <button type="submit" className="h-12 rounded-full bg-[#b85c38] font-semibold text-white">Chat shuru karo</button>
            </form>
          ) : (
            <>
              <Bubbles lines={lines} mine="user" seen={seen} />
              <Composer
                placeholder="Message"
                onType={(typingNow) => void setCustomerTyping(typingNow).catch(() => undefined)}
                onSend={async (text, image) => {
                  await sendSupport({ name: name.trim(), email: user?.primaryEmail || "", phone, text, image });
                }}
              />
            </>
          )}
        </section>
      )}
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="fixed right-4 z-[70] grid size-14 place-items-center rounded-full bg-[#4a5d3f] text-white shadow-lg" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }} aria-label="Open chat">
          <MessageCircle className="size-7" />
          {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[#b85c38] px-1 text-[11px]">{unread}</span>}
        </button>
      )}
    </>
  );
  return typeof document === "undefined" ? tree : createPortal(tree, document.body);
}

export function SupportChat() {
  return <SupportWidget />;
}
