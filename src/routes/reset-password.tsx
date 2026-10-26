import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PasswordStrength } from "@/components/password-strength";
import { authClient } from "@/lib/auth/auth-client";
import { isPasswordAcceptable } from "@/lib/password";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" && search.token.length > 0 ? search.token : undefined,
    error: typeof search.error === "string" && search.error.length > 0 ? search.error : undefined,
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const token = search.token ?? "";
  const errorParam = search.error;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (!isPasswordAcceptable(password)) {
      toast.error("Choose a stronger password — at least 10 characters and not a common/weak one.");
      return;
    }
    if (!token) {
      toast.error("Missing reset token — request a new link.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token });
      if (error) {
        toast.error(error.message || "Reset failed — link may have expired.");
        return;
      }
    } catch {
      toast.error("Reset failed — link may have expired.");
      return;
    } finally {
      setSubmitting(false);
    }
    // Navigate outside the reset try/catch: login's beforeLoad may throw a
    // redirect (signed-in users) and that must not be reported as a failed reset.
    toast.success("Password updated — you can now sign in.");
    await navigate({ to: "/login", search: {}, replace: true });
  };

  if (errorParam) {
    return (
      <AuthShell
        title="Reset link invalid"
        subtitle="This link is no longer valid. Please request a new one."
      >
        <Alert className="border-destructive/30 bg-destructive/10">
          <AlertTitle className="text-foreground">This reset link cannot be used</AlertTitle>
          <AlertDescription className="text-foreground">{errorParam}</AlertDescription>
        </Alert>
        <Button
          render={<Link to="/forgot-password" data-testid="link-forgot-again" />}
          variant="outline"
          className="mt-4"
        >
          Request a new link
        </Button>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell
        title="Reset your password"
        subtitle="Missing token. Check your email for the full link."
      >
        <Button
          render={<Link to="/forgot-password" data-testid="link-forgot-again" />}
          variant="outline"
        >
          Request a new link
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Pick a new password"
      subtitle="At least 10 characters. A passphrase is strongest."
    >
      <form onSubmit={onSubmit} className="space-y-4" data-testid="reset-form">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password" className="label-caps text-muted-foreground">
              New password
            </FieldLabel>
            <Input
              id="password"
              data-testid="input-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <PasswordStrength password={password} />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm" className="label-caps text-muted-foreground">
              Confirm password
            </FieldLabel>
            <Input
              id="confirm"
              data-testid="input-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
        </FieldGroup>
        <Button
          type="submit"
          data-testid="submit-reset"
          disabled={submitting}
          size="lg"
          className="w-full font-bold"
        >
          {submitting ? <Spinner /> : null}
          {submitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
