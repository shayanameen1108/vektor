import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

const CONTACT_EMAIL = "support@vektorhq.co.za";
const COMPANY_NAME = "EcoBuiltConnect (Pty) Ltd";

function PrivacyPage() {
  return (
    <div className="min-h-svh bg-card" data-testid="privacy-page">
      <PublicHeader testId="privacy-header" brandTestId="privacy-brand-link">
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
          <Link
            to="/about"
            data-testid="privacy-nav-about"
            className="font-semibold text-foreground"
          >
            About
          </Link>
          <Link
            to="/help"
            data-testid="privacy-nav-help"
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            Help
          </Link>
          <Link
            to="/terms"
            data-testid="privacy-nav-terms"
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            Terms
          </Link>
          <Button render={<Link to="/login" search={{}} data-testid="privacy-nav-login" />}>
            Sign in
          </Button>
        </nav>
      </PublicHeader>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <p className="overline-label text-muted-foreground" data-testid="privacy-eyebrow">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="privacy-updated">
          Last updated: 2026-02-26
        </p>

        <div className="legal-copy mt-8 max-w-none">
          <section id="who-we-are" data-testid="privacy-section-who-we-are" className="scroll-mt-8">
            <h2 className="text-xl font-bold tracking-tight">Who We Are</h2>
            <p>
              Vektor is operated by {COMPANY_NAME} (“<strong>we</strong>”, “<strong>us</strong>”),
              the responsible party under the Protection of Personal Information Act 4 of 2013 (“
              <strong>POPIA</strong>”). This Privacy Policy explains what personal information we
              collect when you use Vektor at{" "}
              <a
                href="https://www.vektorhq.co.za"
                data-testid="privacy-site-link"
                className="text-primary underline underline-offset-2"
              >
                www.vektorhq.co.za
              </a>
              , why we collect it, and your rights.
            </p>
            <p>
              If anything is unclear or you want to exercise a right described here, email our
              Information Officer at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                data-testid="privacy-contact-link"
                className="text-primary underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section
            id="service-providers"
            data-testid="privacy-section-service-providers"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">Service Providers</h2>
            <p>
              We use Cloudflare to run Vektor and store account records and uploaded files in D1 and
              R2, Resend to deliver transactional email, and Cloudflare Workers AI to analyse
              extracted tender text. These providers process only the data needed to deliver those
              services under their respective data-protection terms.
            </p>
            <p>
              Tender analysis may send text extracted from your uploaded tender to the AI provider.
              Do not upload information that you are not authorised to process.
            </p>
          </section>

          <section
            id="what-we-collect"
            data-testid="privacy-section-what-we-collect"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">
              What Personal Information We Collect
            </h2>
            <p>We collect only the minimum information needed to provide Vektor.</p>
            <p className="font-semibold text-foreground">From you directly:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Account details (name, email, hashed password)</li>
              <li>
                Company profile (company name, CIPC registration number, SARS Tax Clearance PIN,
                CIDB CRS numbers, B-BBEE Level, contact email & phone)
              </li>
              <li>
                Statutory documents you upload (tax clearance, CIDB certificate, B-BBEE affidavit,
                COIDA letter, etc.)
              </li>
              <li>Tender documents you upload for analysis</li>
              <li>EFT proof of payment (bank statement extracts, transfer receipts)</li>
              <li>
                If you sign up using a referral link, the referral code and the resulting reward
                audit trail
              </li>
            </ul>
            <p className="font-semibold text-foreground">Automatically:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                IP address, browser type, and session duration (for security & abuse prevention)
              </li>
              <li>Pages visited within Vektor and features used (for product analytics)</li>
              <li>Timestamps of tender analyses, credit usage, and expiry-alert delivery</li>
            </ul>
            <p>
              We do <strong>not</strong> collect racial, religious, health, sexual, or biometric
              data. We do not use tracking cookies from advertising networks.
            </p>
          </section>

          <section
            id="why-we-collect"
            data-testid="privacy-section-why-we-collect"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">Why We Collect It</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Providing the Service:</strong> parsing your tender documents, calculating
                B-BBEE points, storing your compliance vault, sending expiry reminders.
              </li>
              <li>
                <strong>Account & billing management:</strong> authenticating you, processing EFT
                payments, invoicing, and refunds.
              </li>
              <li>
                <strong>Communications:</strong> transactional emails (password reset, payment
                confirmation, expiry alerts).
              </li>
              <li>
                <strong>Legal compliance & fraud prevention:</strong> retaining payment records
                under the Tax Administration Act.
              </li>
            </ul>
          </section>

          <section
            id="retention"
            data-testid="privacy-section-retention"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">How Long We Keep It</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Active account data:</strong> as long as your account is active.
              </li>
              <li>
                <strong>Uploaded documents:</strong> until you delete them, or 30 days after account
                termination.
              </li>
              <li>
                <strong>Payment records:</strong> 5 years after each transaction (Tax Administration
                Act Section 29).
              </li>
              <li>
                <strong>Server logs:</strong> 90 days rolling.
              </li>
            </ul>
          </section>

          <section
            id="your-rights"
            data-testid="privacy-section-your-rights"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">Your Rights Under POPIA</h2>
            <p>You have the right to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Access</strong> the personal information we hold about you (Section 23).
              </li>
              <li>
                <strong>Correct</strong> inaccurate or outdated information (Section 24).
              </li>
              <li>
                <strong>Delete</strong> your account and associated data, subject to legal retention
                requirements (Section 24).
              </li>
              <li>
                <strong>Object</strong> to processing on reasonable grounds (Section 11(3)).
              </li>
              <li>
                <strong>Complain</strong> to the Information Regulator if we mishandle your data.
              </li>
            </ul>
            <p>
              To exercise any right, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                data-testid="privacy-rights-contact-link"
                className="text-primary underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              with the subject line “POPIA Request”. We respond within 30 days.
            </p>
          </section>

          <section
            id="security"
            data-testid="privacy-section-security"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">Security</h2>
            <p>We protect your data with:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Better Auth password hashing and database-backed session management</li>
              <li>HTTPS/TLS 1.3 encryption in transit</li>
              <li>At-rest encryption on documents in R2 storage</li>
              <li>HttpOnly, Secure, SameSite session cookies</li>
              <li>Multi-tenant data isolation — your data is scoped to your account only</li>
            </ul>
            <p>
              If we ever suffer a breach affecting your personal information, we will notify you and
              the Information Regulator within 72 hours as required by Section 22 of POPIA.
            </p>
          </section>

          <section
            id="bargaining-privacy"
            data-testid="privacy-section-bargaining"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">
              Bargaining Council Compliance & Verification
            </h2>
            <p>
              When you use Vektor to check CIDB, bargaining council, or statutory compliance, you
              remain responsible for verifying facts at the official sources. For your convenience
              we link directly to:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>
                <a
                  href="https://registers.cidb.org.za"
                  target="_blank"
                  rel="noreferrer"
                  data-testid="privacy-cidb-link"
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  CIDB Registers of Contractors ↗
                </a>{" "}
                — confirm CIDB grade, class, and status.
              </li>
              <li>
                <a
                  href="https://esearch.cipc.co.za/"
                  target="_blank"
                  rel="noreferrer"
                  data-testid="privacy-cipc-link"
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  CIPC eSearch ↗
                </a>{" "}
                — verify company registration.
              </li>
              <li>
                <a
                  href="https://secure.csd.gov.za/"
                  target="_blank"
                  rel="noreferrer"
                  data-testid="privacy-csd-link"
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  CSD (MAAA) portal ↗
                </a>
              </li>
              <li>
                <a
                  href="https://tools.sars.gov.za/tcc/"
                  target="_blank"
                  rel="noreferrer"
                  data-testid="privacy-sars-link"
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  SARS TCS portal ↗
                </a>
              </li>
              <li>
                <a
                  href="https://www.bccei.co.za"
                  target="_blank"
                  rel="noreferrer"
                  data-testid="privacy-bccei-link"
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  BCCEI
                </a>{" "}
                ·{" "}
                <a
                  href="https://www.nbcei.co.za"
                  target="_blank"
                  rel="noreferrer"
                  data-testid="privacy-nbcei-link"
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  NBCEI
                </a>{" "}
                ·{" "}
                <a
                  href="https://www.meibc.co.za"
                  target="_blank"
                  rel="noreferrer"
                  data-testid="privacy-meibc-link"
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  MEIBC
                </a>{" "}
                — sectoral bargaining councils.
              </li>
            </ul>
          </section>

          <section id="contact" data-testid="privacy-section-contact" className="mt-10 scroll-mt-8">
            <h2 className="text-xl font-bold tracking-tight">Contact Us</h2>
            <p>Information Officer & Data Protection queries:</p>
            <p>
              {COMPANY_NAME}
              <br />
              Email:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                data-testid="privacy-footer-contact-link"
                className="text-primary underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              <br />
              Web:{" "}
              <a
                href="https://www.vektorhq.co.za"
                data-testid="privacy-footer-site-link"
                className="text-primary underline underline-offset-2"
              >
                www.vektorhq.co.za
              </a>
            </p>
            <p className="text-sm text-muted-foreground">
              You can also review our{" "}
              <Link
                to="/terms"
                data-testid="privacy-inline-terms-link"
                className="text-primary underline underline-offset-2"
              >
                Terms of Service
              </Link>{" "}
              for how the Service is provided.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-6 text-sm">
          <Link
            to="/about"
            data-testid="privacy-link-about"
            className="font-semibold text-foreground underline underline-offset-2"
          >
            About Vektor →
          </Link>
          <Link
            to="/help"
            data-testid="privacy-link-help"
            className="font-semibold text-foreground underline underline-offset-2"
          >
            Help &amp; Guides →
          </Link>
          <Link
            to="/terms"
            data-testid="privacy-link-terms"
            className="font-semibold text-foreground underline underline-offset-2"
          >
            Terms of Service →
          </Link>
        </div>
      </main>

      <PublicFooter testIdPrefix="privacy" />
    </div>
  );
}
