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
      <main className="grid min-h-dvh place-items-center bg-[#07080a] px-4 text-center text-white">
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
    <main className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#f4efe4] px-3 py-3 text-[#3b2a22]">
      <header className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">PINAKI desk</h1>
          <p className="text-xs text-[#7a6557]">{session.name} · {session.id}</p>
        </div>
        <button type="button" className="text-sm text-[#7a6557]" onClick={() => logoutDesk()}>Log out</button>
      </header>
      <div className="mb-2 flex shrink-0 gap-2">
        {chat && <button type="button" onClick={() => setTab("chat")} className={`rounded-full px-3 py-1 text-sm ${tab === "chat" ? "bg-[#00a884]" : "bg-[#e4d8c8]"}`}>Chat</button>}
        {team && <button type="button" onClick={() => setTab("team")} className={`rounded-full px-3 py-1 text-sm ${tab === "team" ? "bg-[#00a884]" : "bg-[#e4d8c8]"}`}>Create login</button>}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "team" && team ? <div className="h-full overflow-y-auto"><DeskTeam /></div> : null}
        {tab === "chat" && chat ? <SupportInbox /> : null}
        {!chat && !team ? <p className="text-sm text-[#7a6557]">Is login pe koi access nahi diya gaya.</p> : null}
      </div>
    </main>
  );
}
