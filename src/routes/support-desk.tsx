import { createFileRoute, Link } from "@tanstack/react-router";
import { SupportInbox } from "@/components/support-chat";
import { isOwnerEmail } from "@/lib/firebase";
import { getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { logoutSupportAgent, useSupportAgent } from "@/lib/support-staff";

export const Route = createFileRoute("/support-desk")({
  component: SupportDeskPage,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});

function SupportDeskPage() {
  const agent = useSupportAgent();
  const owner = isOwnerEmail(getFirebaseCurrentUser()?.email);
  if (!agent && !owner) {
    return (
      <main className="grid min-h-[70vh] place-items-center bg-[#07080a] px-4 text-center text-white">
        <div>
          <p className="text-sm text-white/70">Support employees sign in with the user id created by the owner.</p>
          <Link to="/support-login" className="mt-4 inline-block text-sm underline">Support sign in</Link>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-dvh bg-[#111b21] px-4 py-4 text-white">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Customer support</h1>
          <p className="text-xs text-white/50">{agent ? agent.name : "Owner"} · each customer has a separate chat</p>
        </div>
        {agent ? (
          <button type="button" className="text-sm text-white/60" onClick={() => logoutSupportAgent()}>Log out</button>
        ) : (
          <Link to="/admin" className="text-sm text-white/60">Owner desk</Link>
        )}
      </header>
      <SupportInbox />
    </main>
  );
}
