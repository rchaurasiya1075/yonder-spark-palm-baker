import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-[#0b141a] px-3 py-3">
      {lines.length === 0 && <p className="text-center text-sm text-white/50">No messages yet.</p>}
      {lines.map((line) => {
        const day = dayLabel(line.at);
        const showDay = day !== lastDay;
        lastDay = day;
        const own = line.from === mine;
        const read = !!seen && line.at <= seen;
        return (
          <div key={line.id}>
            {showDay && <p className="my-2 text-center text-[11px] text-white/45">{day}</p>}
            <div className={`max-w-[78%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm ${own ? "ml-auto bg-[#005c4b] text-white" : "bg-[#202c33] text-white"}`}>
              {line.text && <p className="whitespace-pre-wrap leading-5">{line.text}</p>}
              {line.image && <img src={line.image} alt="Shared" className="mt-1 max-h-52 rounded-md" />}
              <p className={`mt-0.5 text-right text-[10px] ${own ? "text-white/70" : "text-white/45"}`}>
                {clock(line.at)}
                {own && <span className={read ? "text-[#53bdeb]" : ""}>  ✓✓</span>}
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
      toast.error(err instanceof Error ? err.message : "Message was not sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#202c33] px-2 py-2">
      {quick.length > 0 && (
        <div className="mb-2 overflow-hidden rounded-lg bg-[#111b21]">
          {quick.map((row) => (
            <button key={row.key} type="button" className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5" onClick={() => void send(row.text)}>
              <span className="text-[#00a884]">{row.key}</span> {row.text}
            </button>
          ))}
        </div>
      )}
      {image && <img src={image} alt="Ready to send" className="mb-2 h-14 rounded-md" />}
      <div className="flex items-end gap-2">
        <button type="button" className="grid size-10 place-items-center text-lg text-white/70" onClick={() => file.current?.click()} aria-label="Attach photo">
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
            void shrinkImage(picked).then(setImage).catch((err) => toast.error(err instanceof Error ? err.message : "Photo failed"));
          }}
        />
        <textarea
          value={text}
          rows={1}
          placeholder={placeholder}
          className="max-h-24 min-h-10 flex-1 resize-none rounded-lg bg-[#2a3942] px-3 py-2 text-sm text-white outline-none"
          onChange={(e) => {
            setText(e.target.value);
            onType?.(!!e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" disabled={busy} className="grid size-10 place-items-center rounded-full bg-[#00a884] text-white" onClick={() => void send()} aria-label="Send">
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
    <div className="grid h-full min-h-0 overflow-hidden rounded-xl border border-white/10 bg-[#111b21] text-white lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className={`${thread ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-r border-white/10`}>
        <div className="border-b border-white/10 p-3">
          <p className="text-sm font-semibold">Customer support</p>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, email" className="mt-2 h-9 w-full rounded-lg bg-[#202c33] px-3 text-sm outline-none" />
          <div className="mt-2 flex gap-1 text-[11px]">
            {(["all", "unread", "pending", "resolved"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-full px-2 py-1 capitalize ${filter === id ? "bg-[#00a884] text-white" : "bg-white/5 text-white/60"}`}>
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
                <button type="button" onClick={() => setOpen(row.userId)} className={`flex w-full gap-3 border-b border-white/5 px-3 py-3 text-left ${thread?.userId === row.userId ? "bg-white/10" : "hover:bg-white/5"}`}>
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-[#00a884] text-sm font-semibold">
                    {(row.name || "U").slice(0, 1).toUpperCase()}
                    <span className={`absolute bottom-0 right-0 size-2.5 rounded-full border border-[#111b21] ${row.typing || Date.now() - new Date(last?.at || 0).getTime() < 120_000 ? "bg-[#00d26a]" : "bg-white/30"}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{row.name}</span>
                      <span className="shrink-0 text-[10px] text-white/45">{clock(last?.at || "")}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-white/55">{row.typing ? "typing…" : last?.image && !last.text ? "Photo" : last?.text}</span>
                      {row.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-[#00a884] px-1 text-[10px]">{row.unread}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="px-3 py-6 text-sm text-white/50">No complaints in this filter.</li>}
        </ul>
      </aside>

      <section className={`${thread ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col`}>
        {!thread && <div className="grid flex-1 place-items-center text-sm text-white/50">Select a customer</div>}
        {thread && (
          <>
            <header className="flex items-center gap-3 border-b border-white/10 bg-[#202c33] px-3 py-2">
              <button type="button" className="text-sm text-white/70 lg:hidden" onClick={() => setOpen(null)}>Back</button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{thread.name}</p>
                <p className="text-[11px] text-white/50">{thread.typing ? "typing…" : thread.phone || thread.email || "Offline"}</p>
              </div>
              <button type="button" className="rounded-full bg-white/10 px-2 py-1 text-[11px]" onClick={() => void setSupportStatus(thread.userId, thread.status === "resolved" ? "pending" : "resolved")}>
                {thread.status === "resolved" ? "Resolved" : "Mark resolved"}
              </button>
              <button type="button" className="text-xs text-white/60 xl:hidden" onClick={() => setInfo((v) => !v)}>Info</button>
            </header>
            {thread.status === "resolved" && <p className="bg-[#182229] py-1 text-center text-[11px] text-white/50">Marked resolved</p>}
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
        <aside className={`${info ? "flex" : "hidden"} min-h-0 flex-col gap-4 overflow-y-auto border-l border-white/10 bg-[#111b21] p-4 xl:flex`}>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Customer</p>
            <p className="mt-2 text-base font-medium">{thread.name}</p>
            <p className="mt-1 text-sm text-white/70">{thread.email || "No email"}</p>
            <p className="text-sm text-white/70">{thread.phone || "No phone"}</p>
            <p className="mt-1 text-xs text-white/40">Joined {thread.createdAt ? dayLabel(thread.createdAt) : "—"}</p>
            <p className="mt-1 text-xs text-white/40">Status {thread.status}</p>
          </div>
          <label className="block text-xs text-white/50">
            Internal note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-28 w-full rounded-lg bg-[#202c33] p-2 text-sm text-white outline-none" placeholder="Only the admin team sees this" />
          </label>
          <button type="button" className="rounded-lg bg-[#00a884] py-2 text-sm" onClick={() => void saveSupportNote(thread.userId, note).then(() => toast.success("Note saved")).catch((err) => toast.error(err instanceof Error ? err.message : "Note failed"))}>
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

export function SupportWidget() {
  const { user } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<SupportLine[]>([]);
  const [typing, setTyping] = useState(false);
  const [seen, setSeen] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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
    const at = new Date().toISOString();
    setSeen(at);
    void markCustomerSeen().catch(() => undefined);
  }, [open, lines.length]);
  const unread = lines.filter((line) => line.from === "admin" && line.at > seen).length;

  return (
    <>
      {open && (
        <section className="fixed inset-x-3 bottom-20 z-50 flex h-[min(640px,calc(100dvh-6.5rem))] flex-col overflow-hidden rounded-2xl border border-black/10 bg-[#0b141a] text-white shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[380px]">
          <header className="flex shrink-0 items-center gap-2 bg-[#075e54] px-3 py-3 text-white">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">PINAKI Support</p>
              <p className="text-[11px] text-white/80">{typing ? "Support is typing…" : "Hum yahin reply karenge"}</p>
            </div>
            <button type="button" className="grid size-9 place-items-center rounded-full hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close chat"><X className="size-5" /></button>
          </header>
          <div className="grid shrink-0 gap-2 bg-[#111b21] p-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aapka naam" className="h-10 rounded-lg bg-[#202c33] px-3 text-sm text-white outline-none" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile" className="h-10 rounded-lg bg-[#202c33] px-3 text-sm text-white outline-none" />
          </div>
          {lines.length === 0 && <p className="shrink-0 bg-[#111b21] px-3 pb-2 text-sm text-white/70">Namaste. Order, delivery, ya product yahin likho.</p>}
          <Bubbles lines={lines} mine="user" seen={seen} />
          <Composer
            placeholder="Message likho"
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
      <button type="button" onClick={() => setOpen((v) => !v)} className="fixed bottom-4 right-4 z-50 grid size-14 place-items-center rounded-full bg-[#00a884] text-white shadow-lg" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }} aria-label="Open support chat">
        {open ? <X className="size-6" /> : <MessageCircle className="size-7" />}
        {!open && unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[#e23b3b] px-1 text-[11px]">{unread}</span>}
      </button>
    </>
  );
}

export function SupportChat() {
  return <SupportWidget />;
}
