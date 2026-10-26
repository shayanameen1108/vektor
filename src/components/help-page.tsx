import { Link } from "@tanstack/react-router";

import { BargainingCouncilTable } from "@/components/bargaining-council-table";
import { PageHeader } from "@/components/page-header";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { entryByLookup } from "@/lib/billing-catalog";
import { formatRand } from "@/lib/money";

function catalogPrice(lookupKey: string): string {
  return formatRand((entryByLookup(lookupKey)?.amount_cents ?? 0) / 100, 0);
}

const PAYG_PRICE = catalogPrice("tc_credits_1_v2");
const STARTER_PRICE = catalogPrice("tc_starter_monthly_v2");
const PRO_PRICE = catalogPrice("tc_pro_monthly_v2");
const SCALE_PRICE = catalogPrice("tc_scale_monthly_v2");

const HELP_INTRO =
  "A walkthrough, a quick-start checklist, and a full feature reference — captions and screenshots.";

type WalkthroughSlide = {
  chapter: number;
  title: string;
  caption: string;
  image: string;
};

const WALKTHROUGH_SLIDES: WalkthroughSlide[] = [
  {
    chapter: 1,
    title: "Welcome to Vektor",
    caption: "Your automated compliance co-pilot for South African public tenders.",
    image: "/help-slides/dashboard.jpg",
  },
  {
    chapter: 2,
    title: "Step 1 — Set up your company",
    caption:
      "Enter your CIPC, CSD/MAAA, SARS TCS PIN, CIDB grades and B-BBEE level. We validate the format live and link you to the official portals.",
    image: "/help-slides/setup.jpg",
  },
  {
    chapter: 3,
    title: "Step 2 — Load your compliance documents",
    caption:
      "Upload Tax Clearance, COIDA, B-BBEE, your Bargaining Council Letter of Good Standing, and director IDs. We track expiry and flag risks automatically.",
    image: "/help-slides/documents.jpg",
  },
  {
    chapter: 4,
    title: "Step 3 — Know your Bargaining Council",
    caption:
      "Every SA construction tender falls under a sectoral council. Civil under BCCEI, electrical under NBCEI, mechanical under MEIBC, and building under a regional BIBC. Vektor warns you if the required letter is missing.",
    image: "/help-slides/documents.jpg",
  },
  {
    chapter: 5,
    title: "Step 4 — Analyze a tender",
    caption:
      "Drop in the tender PDF. Our compliance engine extracts the required CIDB grade, closing date, and mandatory returnables in seconds.",
    image: "/help-slides/analyze.jpg",
  },
  {
    chapter: 6,
    title: "Step 5 — Review Fit Score & Go / No-Go",
    caption:
      "See your fit score, B-BBEE points, and any disqualification risks on a single dashboard.",
    image: "/help-slides/analyze.jpg",
  },
  {
    chapter: 7,
    title: "Step 6 — Auto-fill SBD forms",
    caption:
      "One-click download of SBD 4 and SBD 6.1 pre-filled with your company vault details, including the authorised signatory name and position.",
    image: "/help-slides/analyze.jpg",
  },
  {
    chapter: 8,
    title: "Track everything in Recent Activity",
    caption:
      "Every analysis, EFT payment, and referral reward lives one glance away on your dashboard.",
    image: "/help-slides/dashboard.jpg",
  },
  {
    chapter: 9,
    title: "Pay by EFT — no card fees",
    caption: `Start with 5 free credits. Top up with a ${PAYG_PRICE} single analysis or subscribe to Starter, Pro, or Scale.`,
    image: "/help-slides/billing.jpg",
  },
  {
    chapter: 10,
    title: "Earn credits with referrals",
    caption:
      "Invite a friend. When they upgrade to a paid plan you unlock free credits — up to 10 per referral.",
    image: "/help-slides/billing.jpg",
  },
];

function QuickStartCard({
  number,
  title,
  body,
  testId,
}: {
  number: number;
  title: string;
  body: string;
  testId: string;
}) {
  return (
    <Card
      className="rounded-sm border-border p-5 shadow-none transition-colors hover:border-muted-foreground"
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
          <span className="text-sm font-bold">{number}</span>
        </div>
        <div>
          <p className="overline-label mb-1 text-muted-foreground">Step {number}</p>
          <CardTitle className="mb-1 text-base font-bold">{title}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">{body}</CardDescription>
        </div>
      </div>
    </Card>
  );
}

function ReferenceSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8" data-testid={`ref-section-${id}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-foreground" aria-hidden>
          •
        </span>
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      </div>
      <div className="legal-copy max-w-none">{children}</div>
    </section>
  );
}

export function HelpContent() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 p-4 sm:p-8">
      <section data-testid="help-walkthrough-section">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-xl font-bold tracking-tight">Static walkthrough — 10 chapters</h2>
          <span className="label-caps text-muted-foreground">No audio · Captions only</span>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Browse each chapter at your own pace. Images are from your actual product screens —
          dashboard, setup, vault, analyze, and billing — so you see the real workflow, not stock
          photos.
        </p>
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          data-testid="walkthrough-slides-grid"
        >
          {WALKTHROUGH_SLIDES.map((slide) => (
            <Card
              key={slide.chapter}
              data-testid={`walkthrough-slide-${slide.chapter}`}
              className="overflow-hidden rounded-sm border-border p-0 shadow-none"
            >
              <div className="relative bg-background">
                <AspectRatio ratio={16 / 10}>
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="h-full w-full object-cover object-top opacity-95"
                    data-testid="walkthrough-slide-image"
                    loading="lazy"
                  />
                </AspectRatio>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-4 text-foreground">
                  <div className="mb-1 overline-label text-muted-foreground">
                    Chapter {slide.chapter} / {WALKTHROUGH_SLIDES.length}
                  </div>
                  <h3
                    className="text-base font-bold leading-tight"
                    data-testid="walkthrough-slide-title"
                  >
                    {slide.title}
                  </h3>
                </div>
              </div>
              <CardContent className="p-4">
                <p
                  className="text-sm leading-relaxed text-muted-foreground"
                  data-testid="walkthrough-slide-caption"
                >
                  {slide.caption}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Each chapter pairs a slide with a short caption — read the walkthrough at your own pace.
        </p>
      </section>

      <section data-testid="help-quickstart-section">
        <h2 className="mb-4 text-xl font-bold tracking-tight">
          Quick-start — six steps to first bid
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <QuickStartCard
            number={1}
            title="Create your company profile"
            body="Head to Company Setup, enter CIPC + CSD MAAA + SARS TCS PIN + B-BBEE level. Live regex checks stop typos before they cost you a bid."
            testId="qs-step-1"
          />
          <QuickStartCard
            number={2}
            title="Load compliance documents"
            body="Upload your Tax Clearance PIN, COIDA letter, B-BBEE cert, and Director IDs to the Document Vault. Expiry alerts are automatic."
            testId="qs-step-2"
          />
          <QuickStartCard
            number={3}
            title="Upload the tender PDF"
            body="Open Analyze Tender, drop the RFP, pick 80/20 or 90/10 preference. One credit is deducted (refunded if the analysis fails)."
            testId="qs-step-3"
          />
          <QuickStartCard
            number={4}
            title="Review Fit Score & risk flags"
            body="A dashboard shows CIDB match, B-BBEE points, mandatory returnables, and a Go / No-Go gauge — instantly."
            testId="qs-step-4"
          />
          <QuickStartCard
            number={5}
            title="Download pre-filled SBD forms"
            body="One-click SBD 4 and SBD 6.1 PDFs, populated with your vault details. Print, sign, submit."
            testId="qs-step-5"
          />
          <QuickStartCard
            number={6}
            title="Top up credits when needed"
            body={`Buy a Single Analysis credit (${PAYG_PRICE}) or subscribe monthly — Starter, Pro, or Scale. Cancel any time from the Billing tab.`}
            testId="qs-step-6"
          />
        </div>
      </section>

      <section data-testid="help-reference-section" className="space-y-8">
        <h2 className="text-xl font-bold tracking-tight">Full feature reference</h2>

        <ReferenceSection id="company" title="Company Profile & Statutory Vault">
          <p>
            Every South African public tender requires a bidder identity that matches the CIPC, CSD
            and SARS registers. On the Company Setup screen we validate every statutory field the
            moment you type:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>CIPC number</strong> must match <code>YYYY/NNNNNN/TT</code>. We derive your
              incorporation year and entity type (Pty Ltd, NPC, CC, etc.) from the code.
            </li>
            <li>
              <strong>CSD MAAA</strong> follows <code>MAAA</code> + 7 digits and is
              case-insensitive.
            </li>
            <li>
              <strong>SARS TCS PIN</strong> is 9–10 alphanumeric characters, normalised to
              uppercase.
            </li>
          </ul>
          <p className="mt-2">
            Each field ships with an “Open official portal” deep-link so you can cross-verify with
            the source of truth.
          </p>
          <p className="mt-3">
            <a
              href="https://esearch.cipc.co.za/"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="help-cipc-link"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              CIPC eSearch — verify company registration ↗
            </a>
            {" · "}
            <a
              href="https://secure.csd.gov.za/"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="help-csd-link"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              National Treasury CSD (MAAA) portal ↗
            </a>
            {" · "}
            <a
              href="https://tools.sars.gov.za/tcc/"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="help-sars-link"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              SARS Tax Compliance Status portal ↗
            </a>
          </p>
        </ReferenceSection>

        <ReferenceSection id="documents" title="Document Vault & Expiry Alerts">
          <p>
            The Vault stores your Tax Clearance PIN, COIDA Letter of Good Standing, B-BBEE affidavit
            or certificate, Bargaining Council Letter of Good Standing, and Director ID copies.
            Uploads are streamed to secure R2 storage. We compute days-to-expiry per document and
            colour-code anything within 30 days as amber, and anything already expired as red —
            before the SBD form flags it for you.
          </p>
        </ReferenceSection>

        <ReferenceSection id="bargaining" title="Bargaining Council Compliance">
          <p>
            Every SA construction tender falls under one or more sectoral bargaining councils. You
            must be registered <em>and</em> in good standing (levies paid, no compliance findings)
            with the relevant council or your bid can be disqualified — even when every other
            document is perfect.
          </p>
          <BargainingCouncilTable variant="help" />
          <p className="mt-3 text-sm text-muted-foreground">
            Upload your current Letter of Good Standing to the Compliance Document Vault as document
            type <strong>Bargaining Council Letter of Good Standing</strong>. Tender analysis will
            automatically raise a warning when a tender falls under a council but no letter is on
            file.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Verify CIDB grades at{" "}
            <a
              href="https://registers.cidb.org.za"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="help-cidb-link"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              CIDB Registers of Contractors ↗
            </a>
            .
          </p>
        </ReferenceSection>

        <ReferenceSection id="analyze" title="Tender Analysis Engine">
          <p>
            Drop any RFP PDF onto Analyze Tender. We extract text from the first 20 pages and run it
            through our compliance engine. You get:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Tender title, number, issuing entity, and closing date</li>
            <li>Required CIDB grade (e.g. 4GB)</li>
            <li>Every mandatory returnable (SBD forms, Tax PIN, CSD report, etc.)</li>
          </ul>
          <p className="mt-2">
            We then cross-reference against your Company + Vault to compute a Fit Score, B-BBEE
            points (80/20 or 90/10), and any disqualification risk flags.
          </p>
        </ReferenceSection>

        <ReferenceSection id="gauge" title="Go / No-Go Gauge & Compliance Checklist">
          <p>
            The Go / No-Go gauge is a single glance at bid feasibility. It fuses the Fit Score with
            the returnable checklist — tick each returnable off as you gather it, or upload evidence
            to auto-verify. Once every item is green, you&apos;re clear to submit.
          </p>
        </ReferenceSection>

        <ReferenceSection id="sbd" title="Auto-generated SBD Forms">
          <p>
            From any analysed tender you can download SBD 4 (Declaration of Interest) and SBD 6.1
            (Preference Point Claim) — auto-populated with your company vault details, ready for
            signature. More SBD templates (1, 8, 9) are on the roadmap.
          </p>
        </ReferenceSection>

        <ReferenceSection id="billing" title="Credits & Subscriptions">
          <p>
            New companies start with <strong>5 free tender analyses</strong>. Each Analyze Tender
            run consumes one credit. If extraction fails (unparseable JSON, PDF error, timeout), we
            refund the credit automatically. Top up with a{" "}
            <strong>Single Analysis pack ({PAYG_PRICE})</strong> or subscribe monthly —{" "}
            <strong>Starter {STARTER_PRICE}</strong>, <strong>Pro {PRO_PRICE}</strong>, or{" "}
            <strong>Scale {SCALE_PRICE}</strong> — all in ZAR, paid by EFT directly to our bank
            account (no gateway fees). Payments are facilitated by EcoBuiltConnect (Pty) Ltd via
            First National Bank; credits are added within 1 business day of verification.
          </p>
        </ReferenceSection>

        <ReferenceSection id="portals" title="Official verification portals">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <a
                href="https://esearch.cipc.co.za/"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="help-portal-cipc"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                CIPC eSearch — verify company registration
              </a>
            </li>
            <li>
              <a
                href="https://tools.sars.gov.za/tcc/"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="help-portal-sars"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                SARS Tax Compliance Status portal
              </a>
            </li>
            <li>
              <a
                href="https://secure.csd.gov.za/"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="help-portal-csd"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                National Treasury CSD (MAAA) portal
              </a>
            </li>
            <li>
              <a
                href="https://registers.cidb.org.za/"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="help-portal-cidb"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                CIDB Registers of Contractors
              </a>
            </li>
          </ul>
        </ReferenceSection>
      </section>
    </div>
  );
}

function HelpPublicHeader() {
  return (
    <PublicHeader testId="help-header" brandTestId="help-brand-link">
      <nav aria-label="Primary" className="flex flex-wrap items-center gap-3 text-sm sm:gap-4">
        <Link to="/about" data-testid="help-nav-about" className="font-semibold text-foreground">
          About
        </Link>
        <Link
          to="/terms"
          data-testid="help-nav-terms"
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Terms
        </Link>
        <Link
          to="/privacy"
          data-testid="help-nav-privacy"
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Privacy
        </Link>
        <Button render={<Link to="/login" search={{}} data-testid="help-nav-login" />}>
          Sign in
        </Button>
      </nav>
    </PublicHeader>
  );
}

export function AuthedHelpPage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <PageHeader
        testId="help-header-authed"
        overline="Help & Guides"
        title="How to use Vektor"
        description={HELP_INTRO}
      />
      <HelpContent />
    </div>
  );
}

export function AdminHelpPage() {
  return (
    <>
      <PageHeader
        testId="help-header-admin"
        sticky={false}
        className="border-b-0 bg-transparent px-0 pt-0"
        overline="Help & Guides"
        title="How to use Vektor"
        description={HELP_INTRO}
      />
      <HelpContent />
    </>
  );
}

export function PublicHelpPage() {
  return (
    <div className="min-h-svh" data-testid="help-page">
      <HelpPublicHeader />
      <main>
        <div className="border-b bg-card">
          <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
            <p className="overline-label text-muted-foreground">Help &amp; Guides</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              How to use Vektor
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {HELP_INTRO}
            </p>
          </div>
        </div>
        <HelpContent />
      </main>
      <PublicFooter testIdPrefix="help" />
    </div>
  );
}
