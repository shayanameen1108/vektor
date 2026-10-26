import { MIN_LENGTH, scorePassword } from "@/lib/password";

import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";

const BAR_COLORS = [
  "bg-muted",
  "bg-destructive",
  "bg-status-warning",
  "bg-status-success",
  "bg-status-success",
];
const LABEL_COLORS = [
  "text-muted-foreground",
  "text-destructive",
  "text-status-warning",
  "text-status-success",
  "text-status-success",
];

export function PasswordStrength({ password, email }: { password: string; email?: string }) {
  const { score, label, hint, ok } = scorePassword(password, email);

  if (!password) {
    return (
      <p
        className="mt-2 text-[11px] leading-relaxed text-muted-foreground"
        data-testid="password-requirements"
      >
        Minimum {MIN_LENGTH} characters. Avoid common passwords like &quot;password123&quot;. A
        4-word phrase works well.
      </p>
    );
  }

  return (
    <div className="mt-2" data-testid="password-strength-meter">
      <Progress value={score * 25} aria-label={`Password strength: ${label}`} className="h-1 gap-0">
        <ProgressTrack className="h-1 rounded-sm">
          <ProgressIndicator className={`h-full ${BAR_COLORS[score]}`} />
        </ProgressTrack>
      </Progress>
      <p className={`mt-1.5 text-[11px] leading-relaxed ${LABEL_COLORS[score]}`}>
        <span className="font-semibold">{label}.</span>{" "}
        <span className={ok ? "text-muted-foreground" : "text-muted-foreground/70"}>{hint}</span>
      </p>
    </div>
  );
}
