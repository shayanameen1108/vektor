/**
 * Adapters for the outside services. With ENVIRONMENT="local" (set in
 * `.dev.vars`, so dev, e2e and CI) nothing leaves the machine: email lands in
 * an in-memory mailbox and tender analysis runs a deterministic stand-in
 * (src/lib/local-tender-analysis.ts). Production sets no ENVIRONMENT, so it
 * always gets Resend and the Workers AI binding.
 */
export function isLocal(env: { ENVIRONMENT?: string }): boolean {
  return env.ENVIRONMENT === "local";
}

export interface LocalEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  sentAt: string;
}

/**
 * Locally, email goes nowhere: the newest stays in this isolate's memory, for
 * GET /api/dev/mail to show.
 */
export const localMail: LocalEmail[] = [];

/** Stores the email and returns a message id, as Resend would. */
export function sendToLocalMailbox(to: string, subject: string, html: string): string {
  const id = `local_${crypto.randomUUID()}`;
  localMail.unshift({ id, to, subject, html, sentAt: new Date().toISOString() });
  localMail.length = Math.min(localMail.length, 200);
  return id;
}
