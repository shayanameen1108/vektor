/**
 * Reminder email template — threshold-specific accent/banner + HTML.
 * Extracted from reminder.ts to isolate presentation from transport/DB.
 * Templates live here; transport and sweep orchestration live in reminder.ts.
 */

import { DOC_TYPE_LABEL } from "./compliance";
import { formatRand } from "./money";

function thresholdCopy(threshold: number): {
  accent: string;
  badge: string;
  headlineSuffix: string;
} {
  if (threshold <= 0) {
    return {
      accent: "#DC2626",
      badge: "EXPIRED TODAY — INELIGIBLE TO BID",
      headlineSuffix: "expires today",
    };
  }
  if (threshold <= 7) {
    return {
      accent: "#D97706",
      badge: `URGENT — ${threshold} DAYS TO EXPIRY`,
      headlineSuffix: `expires in ${threshold} days`,
    };
  }
  return {
    accent: "#0F766E",
    badge: `${threshold} DAYS TO EXPIRY`,
    headlineSuffix: `expires in ${threshold} days`,
  };
}

export function subjectSuffix(threshold: number): string {
  if (threshold <= 0) return "EXPIRED — Ineligible to Bid";
  if (threshold <= 7) return "URGENT — 7 days to renew";
  return "Renewal reminder — 30 days";
}

export function buildEmailHtml(args: {
  companyName: string;
  docType: string;
  docFile: string;
  expiryDateIso: string;
  threshold: number;
  appUrl: string;
}): string {
  const { companyName, docType, docFile, expiryDateIso, threshold, appUrl } = args;
  const { accent, badge, headlineSuffix } = thresholdCopy(threshold);
  const docLabel = DOC_TYPE_LABEL[docType] ?? docType;

  let expiryPretty = expiryDateIso;
  try {
    const d = new Date(expiryDateIso.replace("Z", "+00:00"));
    if (!Number.isNaN(d.getTime())) {
      expiryPretty = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    }
  } catch {
    expiryPretty = expiryDateIso;
  }

  const bodyExtra =
    threshold <= 0
      ? "Once expired, you cannot submit new public tenders — every bid will be rejected on technicality."
      : "Government tenders reject bids with expired compliance documents. Renew now to protect your pipeline.";

  const safeCompany = escapeHtml(companyName);
  const safeLabel = escapeHtml(docLabel);
  const safeFile = escapeHtml(docFile);
  const safeExpiry = escapeHtml(expiryPretty);

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;">
          <tr>
            <td style="padding:20px 28px;background:#0f172a;color:#f8fafc;">
              <table width="100%"><tr>
                <td style="font-size:20px;font-weight:800;letter-spacing:-0.01em;">
                  <span style="color:#2dd4bf;">V</span>ektor
                </td>
                <td align="right" style="font-size:10px;letter-spacing:0.15em;color:#94a3b8;text-transform:uppercase;">
                  SA Tender Compliance
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 28px 0 28px;">
              <div style="display:inline-block;margin-top:20px;padding:4px 10px;background:${accent};color:#ffffff;font-size:10px;font-weight:700;letter-spacing:0.15em;border-radius:3px;">
                ${escapeHtml(badge)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 4px 28px;">
              <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;letter-spacing:-0.01em;color:#18181b;">
                Your ${safeLabel} ${escapeHtml(headlineSuffix)}
              </h1>
              <p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
                Hi ${safeCompany},
              </p>
              <p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
                Your <strong>${safeLabel}</strong> (<code style="background:#f4f4f5;padding:1px 5px;border-radius:3px;font-size:12px;">${safeFile}</code>) expires on <strong>${safeExpiry}</strong>.
                ${escapeHtml(bodyExtra)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;">
              <table cellpadding="0" cellspacing="0"><tr><td style="background:#18181b;border-radius:4px;">
                <a href="${appUrl}/documents" style="display:inline-block;padding:12px 22px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
                  Renew in Vektor →
                </a>
              </td></tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">
                You're receiving this because <strong>${safeCompany}</strong> enabled Compliance Guardian in Vektor.
                Turn off alerts anytime from Company Setup.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font-size:11px;color:#a1a1aa;">
          Vektor · SA Tender Compliance · <a href="${appUrl}" style="color:#a1a1aa;">Open dashboard</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPasswordResetHtml(args: { url: string; appUrl: string }): string {
  const safeUrl = escapeHtml(args.url);
  const safeAppUrl = escapeHtml(args.appUrl);
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="600" style="background:#fff;border:1px solid #e4e4e7;"><tr><td style="padding:20px 28px;background:#0f172a;color:#fff;font-size:20px;font-weight:800;">Vektor</td></tr><tr><td style="padding:28px;"><h1 style="font-size:22px;margin:0 0 12px;">Reset your password</h1><p style="font-size:14px;line-height:1.6;">Use the secure link below to choose a new Vektor password. This link expires automatically and can only be used once.</p><p style="margin:24px 0;"><a href="${safeUrl}" style="display:inline-block;padding:12px 22px;background:#18181b;color:#fff;text-decoration:none;font-weight:700;">Reset password →</a></p><p style="font-size:12px;color:#71717a;">If you did not request this, ignore this email. Visit <a href="${safeAppUrl}">${safeAppUrl}</a> for support.</p></td></tr></table></td></tr></table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============ EFT payment emails (admin confirm / reject) ============

const EMAIL_SHELL_HEAD = (headerBg: string, headerText: string, badge: string) => `\
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;">
        <tr><td style="padding:20px 28px;background:${headerBg};color:${headerText};">
          <table width="100%"><tr>
            <td style="font-size:20px;font-weight:800;letter-spacing:-0.01em;">Vektor</td>
            <td align="right" style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;">${escapeHtml(badge)}</td>
          </tr></table>
        </td></tr>`;

const EMAIL_SHELL_FOOT = `\
      </table>
      <p style="margin:16px 0 0 0;font-size:11px;color:#a1a1aa;">Vektor · SA Tender Compliance</p>
    </td></tr>
  </table>
</body>
</html>`;

export function buildEftConfirmationHtml(args: {
  reference: string;
  packageName: string;
  amountRands: number;
  creditsGranted: number;
  companyName: string;
  appUrl: string;
}): string {
  const { reference, packageName, amountRands, creditsGranted, companyName, appUrl } = args;
  const amount = formatRand(amountRands);
  return `\
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18181b;">
${EMAIL_SHELL_HEAD("#065f46", "#ecfdf5", "Payment confirmed")}
        <tr><td style="padding:24px 28px 8px 28px;">
          <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;letter-spacing:-0.01em;color:#18181b;">Your payment was received ✓</h1>
          <p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
            We confirmed your EFT payment for <strong>${escapeHtml(packageName)}</strong>${companyName ? ` for <strong>${escapeHtml(companyName)}</strong>` : ""}.
            <strong>${creditsGranted}</strong> tender analysis credit${creditsGranted === 1 ? "" : "s"} have been added to your account.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin-top:20px;border-collapse:collapse;width:100%;">
            <tr>
              <td style="padding:10px 14px;background:#fafafa;border:1px solid #e4e4e7;font-size:12px;color:#71717a;width:40%;">Reference</td>
              <td style="padding:10px 14px;background:#fafafa;border:1px solid #e4e4e7;font-size:13px;font-weight:600;color:#18181b;font-family:'SF Mono',Menlo,monospace;">${escapeHtml(reference)}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:12px;color:#71717a;">Package</td>
              <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:13px;color:#18181b;">${escapeHtml(packageName)}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;background:#fafafa;border:1px solid #e4e4e7;font-size:12px;color:#71717a;">Amount</td>
              <td style="padding:10px 14px;background:#fafafa;border:1px solid #e4e4e7;font-size:13px;font-weight:600;color:#18181b;">${amount}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:12px;color:#71717a;">Credits added</td>
              <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:13px;font-weight:600;color:#065f46;">+${creditsGranted}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 28px;">
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#18181b;border-radius:4px;">
            <a href="${appUrl}/billing" style="display:inline-block;padding:12px 22px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">View credits →</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:0 28px 24px 28px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">Thanks for supporting Vektor. Reply to this email if anything looks off.</p>
        </td></tr>
${EMAIL_SHELL_FOOT}`;
}

export function buildEftRejectionHtml(args: {
  reference: string;
  packageName: string;
  amountRands: number;
  reason: string;
  appUrl: string;
}): string {
  const { reference, packageName, amountRands, reason, appUrl } = args;
  const amount = formatRand(amountRands);
  return `\
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18181b;">
${EMAIL_SHELL_HEAD("#7f1d1d", "#fef2f2", "Payment issue")}
        <tr><td style="padding:24px 28px 8px 28px;">
          <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;letter-spacing:-0.01em;color:#18181b;">We couldn&rsquo;t confirm your payment</h1>
          <p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
            We reviewed your proof of payment for <strong>${escapeHtml(packageName)}</strong>
            (reference <strong>${escapeHtml(reference)}</strong>, amount <strong>${amount}</strong>) but could not confirm the deposit.
          </p>
          <div style="margin-top:16px;padding:14px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;">
            <p style="margin:0;font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.1em;">Reason</p>
            <p style="margin:8px 0 0 0;font-size:14px;line-height:1.5;color:#7f1d1d;">${escapeHtml(reason)}</p>
          </div>
          <p style="margin:16px 0 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
            If you believe this is a mistake, reply to this email with a clearer proof of payment
            (bank statement extract or transaction confirmation) and we&rsquo;ll re-check.
            You can also re-upload proof on the Billing page.
          </p>
        </td></tr>
        <tr><td style="padding:20px 28px;">
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#18181b;border-radius:4px;">
            <a href="${appUrl}/billing" style="display:inline-block;padding:12px 22px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Re-upload proof →</a>
          </td></tr></table>
        </td></tr>
${EMAIL_SHELL_FOOT}`;
}

export function buildTestAlertHtml(args: { companyName: string; appUrl: string }): string {
  const safeCompany = escapeHtml(args.companyName);
  return `\
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18181b;">
${EMAIL_SHELL_HEAD("#0f172a", "#f8fafc", "Test alert")}
        <tr><td style="padding:24px 28px 8px 28px;">
          <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;letter-spacing:-0.01em;color:#18181b;">Compliance Guardian is working ✓</h1>
          <p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
            This is a test alert for <strong>${safeCompany}</strong>. If you can read this email,
            expiry reminders will reach you 30 days, 7 days, and on the day a compliance document
            expires.
          </p>
        </td></tr>
        <tr><td style="padding:20px 28px;">
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#18181b;border-radius:4px;">
            <a href="${args.appUrl}/setup" style="display:inline-block;padding:12px 22px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Open Company Setup →</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:0 28px 24px 28px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">You requested this test from Company Setup in Vektor. Turn alerts off anytime.</p>
        </td></tr>
${EMAIL_SHELL_FOOT}`;
}
