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
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lines]);
  let lastDay = "";
  return (
    <div ref={box} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-[#efe7dc] px-3 py-3">
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
          className="h-11 max-h-11 flex-1 resize-none overflow-y-auto rounded-full bg-white px-4 py-2.5 text-base leading-5 text-[#231c16] outline-none ring-1 ring-black/10"
          onChange={(e) => setText(e.target.value)}
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
  const [note, setNote] = useState("");
  const [showInfo, setShowInfo] = useState(false);
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
      const last = row.lines.at(-1)?.text || "";
      return !q || `${row.name} ${row.email} ${row.phone} ${last}`.toLowerCase().includes(q);
    });
  }, [threads, query]);
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
    <div className="flex h-full min-h-0 overflow-hidden bg-[#f4efe4] text-[#3b2a22]">
      <aside className={`${thread ? "hidden md:flex" : "flex"} w-full min-h-0 flex-col border-r border-[#e4d8c8] bg-[#fbf7f0] md:w-[300px]`}>
        <div className="border-b border-[#e4d8c8] px-4 py-3 font-semibold">Active support chats</div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or phone" className="mx-3 mt-3 h-10 rounded-full border border-[#e4d8c8] bg-white px-3 text-sm outline-none" />
        <ul className="mt-2 min-h-0 flex-1 overflow-y-auto">
          {shown.map((row) => {
            const last = row.lines.at(-1);
            return (
              <li key={row.userId}>
                <button type="button" onClick={() => setOpen(row.userId)} className={`flex w-full items-center gap-3 border-b border-[#f4efe4] px-4 py-3 text-left ${thread?.userId === row.userId ? "bg-[#f4efe4]" : "hover:bg-[#f4efe4]"}`}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#4a5d3f] text-sm font-semibold text-[#fbf7f0]">{(row.name || "C").slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{row.name}</span>
                    <span className="block truncate text-xs text-[#7a6557]">{row.typing ? "typing…" : last?.text || "Photo"}</span>
                  </span>
                  {row.unread > 0 && <span className="rounded-full bg-[#b85c38] px-1.5 text-[11px] text-white">{row.unread}</span>}
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="px-4 py-6 text-sm text-[#7a6557]">Abhi koi chat nahi.</li>}
        </ul>
      </aside>

      <section className={`${thread ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col bg-white`}>
        {!thread && <div className="grid flex-1 place-items-center text-sm text-[#7a6557]">Customer select karo</div>}
        {thread && (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-[#e4d8c8] px-4 py-3">
              <div className="min-w-0">
                <button type="button" className="mb-1 text-xs text-[#7a6557] md:hidden" onClick={() => setOpen(null)}>Back</button>
                <p className="truncate font-semibold">{thread.name}</p>
                <p className="text-xs text-[#7a6557]">{thread.phone || thread.email || "Customer"} · {thread.status}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="rounded-md bg-[#f4efe4] px-3 py-1.5 text-xs font-semibold md:hidden" onClick={() => setShowInfo((v) => !v)}>Details</button>
                <button type="button" className="rounded-md bg-[#b85c38] px-3 py-1.5 text-xs font-semibold text-white" onClick={() => void setSupportStatus(thread.userId, thread.status === "resolved" ? "pending" : "resolved")}>
                  {thread.status === "resolved" ? "Reopen" : "End chat"}
                </button>
              </div>
            </header>
            <Bubbles lines={thread.lines} mine="admin" seen={thread.customerSeen} />
            <Composer placeholder="Reply to customer" onType={(typing) => void setAdminTyping(thread.userId, typing).catch(() => undefined)} onSend={(text, image) => replySupport(thread.userId, text, image)} />
          </>
        )}
      </section>

      {thread && (
        <aside className={`${showInfo ? "flex" : "hidden"} absolute inset-0 z-10 min-h-0 flex-col gap-3 overflow-y-auto border-l border-[#e4d8c8] bg-[#f8f4ee] p-4 md:static md:flex md:w-[280px]`}>
          <button type="button" className="self-start text-xs md:hidden" onClick={() => setShowInfo(false)}>Close</button>
          <h3 className="text-sm font-semibold">Customer details</h3>
          <div className="rounded-lg border border-[#e4d8c8] bg-white p-3 text-sm">
            <p className="text-xs uppercase text-[#7a6557]">Profile</p>
            <p className="mt-2"><strong>Name:</strong> {thread.name}</p>
            <p><strong>Phone:</strong> {thread.phone || "—"}</p>
            <p><strong>Email:</strong> {thread.email || "—"}</p>
          </div>
          <label className="text-xs text-[#7a6557]">
            Internal note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-24 w-full rounded-lg border border-[#e4d8c8] bg-white p-2 text-sm text-[#3b2a22] outline-none" />
          </label>
          <button type="button" className="rounded-lg bg-[#4a5d3f] py-2 text-sm text-white" onClick={() => void saveSupportNote(thread.userId, note).then(() => toast.success("Note saved")).catch((err) => toast.error(err instanceof Error ? err.message : "Note failed"))}>Save note</button>
        </aside>
      )}
    </div>
  );
}

const OPEN_EVENT = "pinaki-open-support";
export function openSupportChat() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function useViewportFrame(active: boolean) {
  const [frame, setFrame] = useState({ top: 0, height: 640, narrow: false });
  useEffect(() => {
    if (!active) return;
    const sync = () => {
      const vv = window.visualViewport;
      const narrow = window.innerWidth < 720;
      setFrame({ top: 0, height: narrow && vv ? vv.height : window.innerHeight, narrow });
    };
    sync();
    window.visualViewport?.addEventListener("resize", sync);
    window.addEventListener("resize", sync);
    return () => {
      window.visualViewport?.removeEventListener("resize", sync);
      window.removeEventListener("resize", sync);
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
  const frame = useViewportFrame(open);
  useEffect(() => {
    setName(localStorage.getItem("pinaki-support-name") || user?.displayName || "");
    setPhone(localStorage.getItem("pinaki-support-phone") || "");
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [user?.displayName]);
  useEffect(() => watchMySupport(setLines, setTyping), [user?.id]);
  useEffect(() => {
    if (!open) return;
    setSeen(new Date().toISOString());
    void markCustomerSeen().catch(() => undefined);
  }, [open]);
  const unread = lines.filter((line) => line.from === "admin" && line.at > seen).length;
  const quick = ["Where is my order?", "Delivery time?", "Product help"];
  const panelStyle = frame.narrow
    ? { position: "fixed" as const, left: 0, right: 0, bottom: 0, width: "100%", height: frame.height, maxHeight: "100dvh", zIndex: 80 }
    : { position: "fixed" as const, right: 24, bottom: 96, width: 360, height: 520, zIndex: 80 };

  const tree = (
    <>
      {open && (
        <section className="flex flex-col overflow-hidden rounded-xl bg-white text-[#3b2a22] shadow-2xl ring-1 ring-[#e4d8c8]" style={panelStyle}>
          <header className="flex shrink-0 items-center justify-between bg-[#4a5d3f] px-3 py-3 text-[#fbf7f0]">
            <div>
              <p className="text-sm font-semibold">PINAKI Support</p>
              <p className="text-[11px] text-[#f4efe4]/80"><span className="mr-1 inline-block size-2 rounded-full bg-[#86efac]" />{typing ? "typing…" : "Online"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="size-5" /></button>
          </header>
          {!name.trim() && (
            <div className="grid shrink-0 gap-2 border-b border-[#e4d8c8] bg-[#fbf7f0] p-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aapka naam" className="h-10 rounded-full border border-[#e4d8c8] px-3 text-sm outline-none" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile" className="h-10 rounded-full border border-[#e4d8c8] px-3 text-sm outline-none" />
            </div>
          )}
          <div className="flex shrink-0 gap-2 overflow-x-auto bg-[#f8f4ee] px-3 py-2">
            {quick.map((chip) => (
              <button key={chip} type="button" className="shrink-0 rounded-full border border-[#d7c4ae] bg-white px-3 py-1 text-xs font-semibold text-[#4a5d3f]" onClick={() => {
                if (!name.trim()) return toast.error("Pehle naam likho.");
                localStorage.setItem("pinaki-support-name", name.trim());
                localStorage.setItem("pinaki-support-phone", phone.trim());
                void sendSupport({ name: name.trim(), email: user?.primaryEmail || "", phone, text: chip }).catch((err) => toast.error(err instanceof Error ? err.message : "Message nahi gaya."));
              }}>{chip}</button>
            ))}
          </div>
          <Bubbles lines={lines} mine="user" seen={seen} />
          <Composer
            placeholder="Type your message..."
            onType={(typingNow) => void setCustomerTyping(typingNow).catch(() => undefined)}
            onSend={async (text, image) => {
              if (!name.trim()) throw new Error("Pehle naam likho.");
              localStorage.setItem("pinaki-support-name", name.trim());
              localStorage.setItem("pinaki-support-phone", phone.trim());
              await sendSupport({ name: name.trim(), email: user?.primaryEmail || "", phone, text, image });
            }}
          />
        </section>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} className="fixed right-6 z-[70] grid size-14 place-items-center rounded-full bg-[#4a5d3f] text-white shadow-lg" style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }} aria-label="Open chat">
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        {!open && unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[#b85c38] px-1 text-[11px]">{unread}</span>}
      </button>
    </>
  );
  return typeof document === "undefined" ? tree : createPortal(tree, document.body);
}

export function SupportChat() {
  return <SupportWidget />;
}
