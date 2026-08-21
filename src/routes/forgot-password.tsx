import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { firebaseSendReset } = await import("@/lib/firebase-auth");
      const result = await firebaseSendReset(identifier);
      if (!result.ok) {
        setError(result.error ?? "Could not send reset email.");
        return;
      }
      setSent(true);
    } catch {
      setError("Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">Reset password</h1>
      <p className="mt-2 text-sm text-muted">
        Enter the Gmail, username, or mobile on your account. We send a reset link to the
        email saved on the profile.
      </p>
      {sent ? (
        <div className="mt-8 rounded-xl bg-paper p-6 ring-1 ring-border">
          <p className="text-sm">
            Reset email sent. Check your inbox and spam folder, then sign in with the new
            password.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identifier">Email, username, or mobile</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-8 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link to="/login" className="font-semibold text-accent">
          Sign in
        </Link>
      </p>
    </main>
  );
}
