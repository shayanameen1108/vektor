import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CheckCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/auth-client";
import { getCurrentSession } from "@/lib/auth/session";
import { homeForSession } from "@/lib/destinations";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (session?.user) {
      throw redirect({ to: homeForSession(session) });
    }
  },
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });
      if (error) {
        toast.error(error.message || "Could not send reset link");
        return;
      }
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset link");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email on your account and we'll send you a reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link
            to="/login"
            search={{}}
            data-testid="link-back-to-login"
            className="font-semibold text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <Alert data-testid="forgot-sent-state" className="border-primary/30 bg-primary/10">
          <CheckCircleIcon className="text-primary" aria-hidden="true" />
          <AlertTitle className="text-foreground">Check your inbox</AlertTitle>
          <AlertDescription className="text-foreground">
            <p>
              If <span className="font-mono text-foreground">{email}</span> is registered with
              Vektor, a password-reset link is on its way. The link expires in{" "}
              <strong className="text-foreground">1 hour</strong> and can only be used once.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Didn&apos;t get anything? Check your spam folder, email us at{" "}
              <a
                href="mailto:support@vektorhq.co.za"
                data-testid="forgot-support-email"
                className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                support@vektorhq.co.za
              </a>
              , or{" "}
              <Button
                type="button"
                variant="link"
                onClick={() => setSent(false)}
                data-testid="forgot-try-again-btn"
                className="h-auto p-0 font-semibold underline underline-offset-2 hover:text-primary/80"
              >
                try a different email
              </Button>
              .
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" data-testid="forgot-form">
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
          <Button
            type="submit"
            data-testid="submit-forgot"
            disabled={submitting}
            size="lg"
            className="w-full font-bold"
          >
            {submitting ? <Spinner /> : null}
            {submitting ? "Sending link…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
