import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  component: Login,
});

function safeRedirect(path: string | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  if (path === "/login" || path === "/signup" || path === "/admin") return "/";
  return path;
}

function Login() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const dest = safeRedirect(redirect);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { firebaseIdentifierSignIn } = await import("@/lib/firebase-auth");
      const result = await firebaseIdentifierSignIn(identifier, password);
      if (result.ok) {
        await navigate({ to: dest });
        return;
      }
      if (import.meta.env.VITE_GITHUB_PAGES === "1") {
        setError(result.error ?? "Could not sign in.");
        return;
      }
      if (result.error && !result.unauthorizedDomain) {
        setError(result.error);
      }
      const { error: err } = await authClient.signIn.email({ email: identifier, password });
      if (err) {
        setError(err.message ?? "Could not sign in.");
        return;
      }
      await navigate({ to: dest });
    } catch {
      setError("Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">
        Sign in with Gmail, username, or mobile number.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Email, username, or mobile</Label>
          <Input
            id="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@gmail.com or farmuser or 98xxxxxxxx"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/forgot-password" className="font-semibold text-accent">
          Forgot password?
        </Link>
      </p>
      {authEnabled && import.meta.env.VITE_GITHUB_PAGES !== "1" ? (
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
        New here?{" "}
        <Link to="/signup" search={{ redirect }} className="font-semibold text-accent">
          Create an account
        </Link>
      </p>
    </main>
  );
}
