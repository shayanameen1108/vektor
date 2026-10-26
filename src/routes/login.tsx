import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth-shell";
import { GoogleIcon } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { asVektorSession, authClient } from "@/lib/auth/auth-client";
import { getCurrentSession } from "@/lib/auth/session";
import { type UserDestination, homeForSession, userDestination } from "@/lib/destinations";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: UserDestination } => {
    const next = userDestination(search.redirect);
    return next ? { redirect: next } : {};
  },
  beforeLoad: async ({ search }) => {
    const session = await getCurrentSession();
    if (!session?.user) return;
    throw redirect({ to: homeForSession(session, search.redirect) });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const signInWithGoogle = async () => {
    setGooglePending(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: search.redirect ?? "/app",
        newUserCallbackURL: "/setup",
        errorCallbackURL: "/login",
      });
      if (error) {
        toast.error(error.message ?? "Google sign-in failed");
        setGooglePending(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setGooglePending(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await authClient.signIn.email({ email: email.trim(), password });
      if (error) {
        toast.error(error.message || "Login failed");
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
      return;
    } finally {
      setSubmitting(false);
    }
    toast.success("Welcome back");
    const { data } = await authClient.getSession();
    await navigate({ to: homeForSession(asVektorSession(data), search.redirect) });
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to Vektor."
      eyebrow="Catch expired documents and missed forms before they cost you a bid."
      footer={
        <>
          New to Vektor?{" "}
          <Button
            render={<Link to="/signup" search={{ ref: undefined }} data-testid="link-signup" />}
            variant="link"
            data-testid="cta-create-account"
            className="h-auto p-0 font-semibold text-primary underline underline-offset-2"
          >
            Create a free account
          </Button>
        </>
      }
    >
      <Button
        type="button"
        data-testid="submit-google"
        disabled={submitting || googlePending}
        onClick={() => void signInWithGoogle()}
        variant="outline"
        size="lg"
        className="mb-4 w-full font-bold"
      >
        {googlePending ? <Spinner /> : <GoogleIcon className="size-4 shrink-0" />}
        {googlePending ? "Redirecting to Google…" : "Continue with Google"}
      </Button>
      <div className="mb-4 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="label-caps text-muted-foreground">or with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email" className="label-caps text-muted-foreground">
              Email
            </FieldLabel>
            <Input
              id="email"
              data-testid="input-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.co.za"
            />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password" className="label-caps text-muted-foreground">
                Password
              </FieldLabel>
              <Link
                to="/forgot-password"
                data-testid="link-forgot-password"
                className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              data-testid="input-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </Field>
        </FieldGroup>
        <Button
          type="submit"
          data-testid="submit-login"
          disabled={submitting}
          size="lg"
          className="w-full font-bold"
        >
          {submitting ? <Spinner /> : null}
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 label-caps text-muted-foreground">
        1 tender analysis free on signup · no card required
      </p>
    </AuthShell>
  );
}
