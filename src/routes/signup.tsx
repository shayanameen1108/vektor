import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowRight, GiftIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth-shell";
import { GoogleIcon } from "@/components/google-icon";
import { PasswordStrength } from "@/components/password-strength";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { asVektorSession, authClient } from "@/lib/auth/auth-client";
import { getCurrentSession } from "@/lib/auth/session";
import { homeForSession } from "@/lib/destinations";
import { isPasswordAcceptable } from "@/lib/password";
import { referralLookupQuery } from "@/lib/queries";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" && search.ref.length > 0 ? search.ref : undefined,
  }),
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (session?.user) {
      throw redirect({ to: homeForSession(session) });
    }
  },
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const refCode = search.ref ?? null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const referralQuery = useQuery({
    ...referralLookupQuery(refCode ?? ""),
    enabled: Boolean(refCode),
  });
  const refPreview = referralQuery.data?.referrer_first_name ? referralQuery.data : null;
  const refInvalid =
    Boolean(refCode) && referralQuery.isFetched && !referralQuery.isPending && !refPreview;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordAcceptable(password, email)) {
      toast.error("Please pick a stronger password (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    try {
      // Attribution: referredByCode rides along with the signup; the auth
      // after-hook creates the referrals audit row server-side.
      const normalizedRef = refCode ? refCode.trim().toUpperCase() : undefined;
      await authClient.signUp.email(
        {
          email: email.trim(),
          password,
          name: name.trim() || (email.split("@")[0] ?? email),
          ...(normalizedRef ? { referredByCode: normalizedRef } : {}),
        },
        {
          onError: (ctx) => {
            toast.error(ctx.error.message || "Signup failed");
            throw new Error(ctx.error.message);
          },
        },
      );
    } catch {
      // the failure toast was already surfaced by the auth client callback
      return;
    } finally {
      setSubmitting(false);
    }
    toast.success("Account created — welcome to Vektor");
    const { data } = await authClient.getSession();
    await navigate({ to: homeForSession(asVektorSession(data), "/setup") });
  };

  // Referral codes can't ride along with OAuth: the server-side signup hook
  // only sees referredByCode on email signups. Google signups keep the free
  // credit but don't attribute a referrer.
  const signUpWithGoogle = async () => {
    setGooglePending(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/setup",
        errorCallbackURL: "/signup",
      });
      if (error) {
        toast.error(error.message ?? "Google sign-up failed");
        setGooglePending(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-up failed");
      setGooglePending(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start with 5 free tender analyses. No credit card."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            search={{}}
            data-testid="link-login"
            className="font-semibold text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
          >
            Sign in
          </Link>
        </>
      }
    >
      {refInvalid && (
        <Alert data-testid="signup-referral-invalid" className="mb-6">
          <AlertDescription className="text-foreground">
            That invite code wasn&apos;t recognised — you can still create your account, but no
            referrer will be credited.
          </AlertDescription>
        </Alert>
      )}
      {refPreview && (
        <Alert
          data-testid="signup-referral-banner"
          className="mb-6 border-primary/30 bg-primary/10"
        >
          <GiftIcon className="text-primary" aria-hidden="true" />
          <AlertTitle className="label-caps text-primary">You&apos;ve been invited</AlertTitle>
          <AlertDescription className="text-foreground">
            <span className="font-bold">{refPreview.referrer_first_name}</span>
            {refPreview.referrer_company && (
              <span className="text-muted-foreground"> at {refPreview.referrer_company}</span>
            )}{" "}
            invited you to try Vektor. Get{" "}
            <strong className="text-primary">5 free tender analyses</strong> to see how it works —
            no credit card required.
          </AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        data-testid="submit-google"
        disabled={submitting || googlePending}
        onClick={() => void signUpWithGoogle()}
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
      <form onSubmit={onSubmit} className="space-y-4" data-testid="signup-form">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name" className="label-caps text-muted-foreground">
              Your name
            </FieldLabel>
            <Input
              id="name"
              data-testid="input-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Thabo Molefe"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email" className="label-caps text-muted-foreground">
              Work email
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
            <FieldLabel htmlFor="password" className="label-caps text-muted-foreground">
              Password
            </FieldLabel>
            <Input
              id="password"
              data-testid="input-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="A memorable phrase works best"
              aria-describedby={password ? "password-strength" : "password-requirements"}
            />
            <div id={password ? "password-strength" : "password-requirements"}>
              <PasswordStrength password={password} email={email} />
            </div>
          </Field>
        </FieldGroup>
        <Button
          type="submit"
          data-testid="submit-signup"
          disabled={submitting}
          size="lg"
          className="w-full font-bold"
        >
          {submitting ? <Spinner /> : null}
          {submitting ? "Creating account…" : "Create account & start free"}
          {!submitting && <ArrowRight className="ml-2" aria-hidden="true" />}
        </Button>
      </form>
    </AuthShell>
  );
}
