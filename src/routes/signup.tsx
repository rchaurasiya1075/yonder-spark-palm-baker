import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  component: Signup,
});

function safeRedirect(path: string | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/account";
  return path;
}

function Signup() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const dest = safeRedirect(redirect);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password should be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    let firebaseOk = false;
    try {
      const { firebaseEmailSignUp } = await import("@/lib/firebase-auth");
      const result = await firebaseEmailSignUp(email, password, name);
      firebaseOk = result.ok;
      if (result.error && !result.unauthorizedDomain) {
        setError(result.error);
        setBusy(false);
        return;
      }
    } catch {
      /* Firebase Auth may be blocked on this host; fall through */
    }
    const { error: err } = await authClient.signUp.email({ email, password, name });
    setBusy(false);
    if (err && !firebaseOk) {
      setError(err.message ?? "Could not create account.");
      return;
    }
    await navigate({ to: dest });
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-sm text-muted">
        Create an email and password to save orders and track jars.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      {authEnabled ? (
        <div className="mt-6 space-y-2">
          <p className="text-center text-xs text-muted">Or continue with</p>
          {GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => signIn(p.providerId, { callbackURL: dest })}
            >
              Continue with {p.label}
            </Button>
          ))}
        </div>
      ) : null}
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" search={{ redirect }} className="font-semibold text-accent">
          Sign in
        </Link>
      </p>
    </main>
  );
}
