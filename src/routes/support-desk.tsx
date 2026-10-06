import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SupportInbox } from "@/components/support-chat";
import { DeskTeam } from "@/components/desk-team";
import { canManageTeam, hasAccess, logoutDesk, useDeskSession } from "@/lib/desk-accounts";

export const Route = createFileRoute("/support-desk")({
  component: SupportDeskPage,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});

function SupportDeskPage() {
  const session = useDeskSession();
  const [tab, setTab] = useState<"chat" | "team">("chat");
  if (!session) {
    return (
      <main className="grid min-h-[70vh] place-items-center bg-[#07080a] px-4 text-center text-white">
        <div>
          <p className="text-sm text-white/70">Pehle desk user id aur pin se sign in karo.</p>
          <Link to="/support-login" className="mt-4 inline-block text-sm underline">Desk sign in</Link>
        </div>
      </main>
    );
  }
  const team = canManageTeam(session);
  const chat = hasAccess(session, "chat");
  return (
    <main className="min-h-dvh bg-[#111b21] px-4 py-4 text-white">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">PINAKI desk</h1>
          <p className="text-xs text-white/50">{session.name} · {session.id} · {session.role}</p>
        </div>
        <button type="button" className="text-sm text-white/60" onClick={() => logoutDesk()}>Log out</button>
      </header>
      <div className="mb-4 flex gap-2">
        {chat && <button type="button" onClick={() => setTab("chat")} className={`rounded-full px-3 py-1 text-sm ${tab === "chat" ? "bg-[#00a884]" : "bg-white/10"}`}>Chat</button>}
        {team && <button type="button" onClick={() => setTab("team")} className={`rounded-full px-3 py-1 text-sm ${tab === "team" ? "bg-[#00a884]" : "bg-white/10"}`}>Create login</button>}
      </div>
      {tab === "team" && team ? <DeskTeam /> : null}
      {tab === "chat" && chat ? <SupportInbox /> : null}
      {!chat && !team ? <p className="text-sm text-white/60">Is login pe koi access nahi diya gaya.</p> : null}
    </main>
  );
}
