import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

const CONTACT_EMAIL = "support@vektorhq.co.za";
const COMPANY_NAME = "EcoBuiltConnect (Pty) Ltd";
const COMPANY_JURISDICTION = "Republic of South Africa";

function TermsPage() {
  return (
    <div className="min-h-svh bg-card" data-testid="terms-page">
      <PublicHeader testId="terms-header" brandTestId="terms-brand-link">
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
          <Link to="/about" data-testid="terms-nav-about" className="font-semibold text-foreground">
            About
          </Link>
          <Link
            to="/help"
            data-testid="terms-nav-help"
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            Help
          </Link>
          <Link
            to="/privacy"
            data-testid="terms-nav-privacy"
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            Privacy
          </Link>
          <Button render={<Link to="/login" search={{}} data-testid="terms-nav-login" />}>
            Sign in
          </Button>
        </nav>
      </PublicHeader>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <p className="overline-label text-muted-foreground" data-testid="terms-eyebrow">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="terms-updated">
          Last updated: 2026-02-26
        </p>

        <div className="legal-copy mt-8 max-w-none">
          <section id="acceptance" data-testid="terms-section-acceptance" className="scroll-mt-8">
            <h2 className="text-xl font-bold tracking-tight">Acceptance of Terms</h2>
            <p>
              These Terms of Service (“<strong>Terms</strong>”) govern your access to and use of
              Vektor, a software-as-a-service platform (“
              <strong>Vektor</strong>” or the “<strong>Service</strong>”) operated by {COMPANY_NAME}{" "}
              (“we”, “us”, or “our”), a company incorporated in the {COMPANY_JURISDICTION}.
            </p>
            <p>
              By creating an account, accessing the Service, or purchasing a subscription or credit
              pack, you agree to be bound by these Terms and our{" "}
              <Link
                to="/privacy"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Privacy Policy
              </Link>
              . If you do not agree, do not use the Service.
            </p>
            <p>
              You must be at least 18 years old and legally able to enter into a binding contract in
              South Africa (or your jurisdiction) to use Vektor.
            </p>
          </section>

          <section id="service" data-testid="terms-section-service" className="mt-10 scroll-mt-8">
            <h2 className="text-xl font-bold tracking-tight">What Vektor Does</h2>
            <p>
              Vektor is a compliance and bid-intelligence platform for the South African public
              procurement market. The Service uses automated analysis to parse tender documents
              (RFPs, SBD packs, etc.), match them against your company’s statutory documentation,
              calculate B-BBEE preference points, and flag compliance risks before you submit a bid.
            </p>
            <p>
              Vektor is a <strong>decision-support tool</strong>. Every output — including Go/No-Go
              recommendations, B-BBEE point calculations, SBD form auto-fills, and expiry alerts —
              is provided <strong>for guidance only</strong> and does not constitute legal,
              financial, or tender-compliance advice. You remain solely responsible for verifying
              every fact and submitting complete, accurate bids in accordance with the tender’s
              Special Conditions of Contract and all applicable law (including the Preferential
              Procurement Policy Framework Act 5 of 2000, its regulations, and the B-BBEE Codes of
              Good Practice).
            </p>
          </section>

          <section id="account" data-testid="terms-section-account" className="mt-10 scroll-mt-8">
            <h2 className="text-xl font-bold tracking-tight">Your Account</h2>
            <p>
              To use Vektor you must register an account with a valid email address and strong
              password. You are responsible for keeping your credentials confidential and for all
              activity that occurs under your account.
            </p>
            <p>
              Notify us immediately at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              if you suspect unauthorised access.
            </p>
          </section>

          <section id="plans" data-testid="terms-section-plans" className="mt-10 scroll-mt-8">
            <h2 className="text-xl font-bold tracking-tight">Plans, Credits &amp; Billing</h2>
            <p>
              Vektor offers three monthly subscription plans (<strong>Starter</strong>,{" "}
              <strong>Pro</strong>, and <strong>Scale</strong>) plus a pay-as-you-go{" "}
              <strong>Single Analysis</strong> credit for one-off tender checks. Each tender
              analysis consumes one credit. Subscription credits{" "}
              <strong>roll over up to 2× your monthly allowance</strong>; credits above the cap are
              forfeited at the start of the next cycle.
            </p>
            <p>
              New accounts receive <strong>five free trial credits</strong> when the company profile
              is first created.
            </p>
            <p>
              <strong>Payment is by EFT</strong> directly to our{" "}
              <strong>First National Bank</strong> business account, held by{" "}
              <strong>EcoBuiltConnect (Pty) Ltd</strong>. When you initiate a purchase we generate a
              unique reference; you make the EFT from your bank and upload proof of payment. Credits
              are activated within <strong>1 business day</strong> after we verify the deposit.
            </p>
            <p>
              All prices are in <strong>South African Rand</strong> and are inclusive of VAT unless
              stated otherwise.
            </p>
          </section>

          <section
            id="referrals"
            data-testid="terms-section-referrals"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">Referral Program</h2>
            <p>
              Vektor operates a <strong>referrer-only</strong> credit reward programme. When you
              share your unique referral link and the person you invite upgrades to a paid
              subscription plan, we credit your primary company’s account with free tender analyses:{" "}
              <strong>+3 credits</strong> for a Starter upgrade, <strong>+5 credits</strong> for a
              Pro upgrade, or <strong>+10 credits</strong> for a Scale upgrade.
            </p>
            <p>
              Rewards are triggered <strong>only</strong> when the invited party’s first paid
              subscription EFT is verified and confirmed by us — not on signup, and not on a Single
              Analysis credit pack purchase.
            </p>
            <p>
              Rewards are capped at <strong>5 successful referrals per calendar month</strong> and{" "}
              <strong>20 successful referrals for the lifetime of your account</strong>.
              Self-referral or duplicate accounts will result in forfeiture.
            </p>
          </section>

          <section
            id="bargaining"
            data-testid="terms-section-bargaining"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">
              Bargaining Council &amp; CIDB Compliance Context
            </h2>
            <p>
              South African construction tenders require compliance with sectoral bargaining
              councils. Civil engineering (CE) falls under{" "}
              <a
                href="https://www.bccei.co.za"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                BCCEI
              </a>
              , electrical (EB/EP) under{" "}
              <a
                href="https://www.nbcei.co.za"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                NBCEI
              </a>
              , mechanical (ME) under{" "}
              <a
                href="https://www.meibc.co.za"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                MEIBC
              </a>
              , and general building (GB) under regional BIBCs. Your CIDB grade and class must match
              the tender’s requirement (higher grades cover lower within the same class).
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Verify at{" "}
              <a
                href="https://registers.cidb.org.za"
                target="_blank"
                rel="noreferrer"
                data-testid="terms-cidb-link"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                CIDB Registers of Contractors ↗
              </a>{" "}
              and cross-check statutory numbers at{" "}
              <a
                href="https://esearch.cipc.co.za/"
                target="_blank"
                rel="noreferrer"
                data-testid="terms-cipc-link"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                CIPC eSearch ↗
              </a>
              ,{" "}
              <a
                href="https://secure.csd.gov.za/"
                target="_blank"
                rel="noreferrer"
                data-testid="terms-csd-link"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                CSD ↗
              </a>{" "}
              and{" "}
              <a
                href="https://tools.sars.gov.za/tcc/"
                target="_blank"
                rel="noreferrer"
                data-testid="terms-sars-link"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                SARS TCS ↗
              </a>
              .
            </p>
          </section>

          <section
            id="liability"
            data-testid="terms-section-liability"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, our aggregate liability arising out of or in
              connection with the Service shall not exceed the total fees you have paid to us in the{" "}
              <strong>12 months preceding the claim</strong>.
            </p>
            <p>
              We are not liable for indirect, consequential, incidental, special, exemplary, or
              punitive damages, including lost profits, lost bids, lost contracts, or lost data.
            </p>
          </section>

          <section
            id="governing-law"
            data-testid="terms-section-governing-law"
            className="mt-10 scroll-mt-8"
          >
            <h2 className="text-xl font-bold tracking-tight">
              Governing Law &amp; Dispute Resolution
            </h2>
            <p>
              These Terms are governed by the laws of the {COMPANY_JURISDICTION}. Any dispute
              arising out of or in connection with these Terms shall be referred to the exclusive
              jurisdiction of the High Court of South Africa, Western Cape Division, Cape Town.
            </p>
          </section>

          <section id="contact" data-testid="terms-section-contact" className="mt-10 scroll-mt-8">
            <h2 className="text-xl font-bold tracking-tight">Contact</h2>
            <p>Questions about these Terms? Reach us at:</p>
            <p>
              {COMPANY_NAME}
              <br />
              Email:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              <br />
              Web:{" "}
              <a
                href="https://www.vektorhq.co.za"
                className="text-primary underline underline-offset-2"
              >
                www.vektorhq.co.za
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-6 text-sm">
          <Link
            to="/about"
            data-testid="terms-link-about"
            className="font-semibold text-foreground underline underline-offset-2"
          >
            About Vektor →
          </Link>
          <Link
            to="/help"
            data-testid="terms-link-help"
            className="font-semibold text-foreground underline underline-offset-2"
          >
            Help &amp; Guides →
          </Link>
          <Link
            to="/privacy"
            data-testid="terms-link-privacy"
            className="font-semibold text-foreground underline underline-offset-2"
          >
            Privacy Policy →
          </Link>
          <a
            href="https://registers.cidb.org.za"
            target="_blank"
            rel="noreferrer"
            data-testid="terms-footer-cidb-link"
            className="font-semibold text-foreground underline underline-offset-2"
          >
            CIDB Registers ↗
          </a>
        </div>
      </main>

      <PublicFooter testIdPrefix="terms" />
    </div>
  );
}
