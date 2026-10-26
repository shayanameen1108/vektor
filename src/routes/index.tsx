import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChartLine,
  CheckCircle,
  Clock,
  FileText,
  Menu,
  ShieldCheck,
} from "lucide-react";

import { VektorMark } from "@/components/vektor-mark";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getCurrentSession } from "@/lib/auth/session";
import { CATALOG, PLAN_SUPPORT } from "@/lib/billing-catalog";
import { homeForSession } from "@/lib/destinations";
import { formatRand } from "@/lib/money";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (session?.user) {
      throw redirect({ to: homeForSession(session) });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-svh overflow-x-hidden bg-background text-foreground">
      <TopNav />
      <main>
        <Hero />
        <SocialProofStrip />
        <FeaturesSection />
        <HowItWorks />
        <ProductProofSection />
        <PricingSection />
        <PartnersSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

const LANDING_NAV = [
  { href: "#features", label: "Features", testId: "landing-nav-features" },
  { href: "#how-it-works", label: "How it works", testId: "landing-nav-how-it-works" },
  { href: "#pricing", label: "Pricing", testId: "landing-nav-pricing" },
  { href: "#partners", label: "Partners", testId: "landing-nav-partners" },
  { href: "#faq", label: "FAQ", testId: "landing-nav-faq" },
] as const;

const TopNav = () => (
  <header
    data-testid="landing-nav"
    className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background"
  >
    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
      <Link to="/" data-testid="landing-logo" className="flex items-center gap-3">
        <VektorMark />
        <span className="text-xl font-bold tracking-tight">Vektor</span>
      </Link>
      <nav className="hidden items-center gap-8 text-sm text-muted-foreground lg:flex">
        {LANDING_NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            data-testid={item.testId}
            className="transition-colors hover:text-foreground"
          >
            {item.label}
          </a>
        ))}
        <Link
          to="/about"
          data-testid="landing-nav-about"
          className="transition-colors hover:text-foreground"
        >
          About
        </Link>
      </nav>
      <div className="flex items-center gap-3">
        <Link
          to="/login"
          search={{}}
          data-testid="landing-signin"
          className="hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground lg:inline"
        >
          Sign in
        </Link>
        <Button
          render={<Link to="/signup" search={{ ref: undefined }} data-testid="landing-cta-nav" />}
          className="hidden font-bold lg:inline-flex"
        >
          Start free
          <ArrowRight aria-hidden="true" />
        </Button>
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                data-testid="landing-mobile-menu"
                aria-label="Open menu"
                className="lg:hidden !size-11"
              />
            }
          >
            <Menu aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72" data-testid="landing-mobile-sheet">
            <SheetHeader>
              <SheetTitle>Vektor</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {LANDING_NAV.map((item) => (
                <SheetClose
                  key={item.href}
                  nativeButton={false}
                  render={
                    <a
                      href={item.href}
                      data-testid={`${item.testId}-mobile`}
                      className="rounded-sm px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {item.label}
                    </a>
                  }
                />
              ))}
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    to="/about"
                    data-testid="landing-nav-about-mobile"
                    className="rounded-sm px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    About
                  </Link>
                }
              />
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    to="/login"
                    search={{}}
                    data-testid="landing-signin-mobile"
                    className="rounded-sm px-3 py-3 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Sign in
                  </Link>
                }
              />
              <SheetClose
                nativeButton={false}
                render={
                  <Button
                    render={
                      <Link
                        to="/signup"
                        search={{ ref: undefined }}
                        data-testid="landing-cta-mobile"
                      />
                    }
                    className="mt-2 w-full text-sm font-bold"
                  >
                    Start free
                  </Button>
                }
              />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  </header>
);

const HERO_CHECKS = [
  { label: "SBD 4 declaration", ok: true },
  { label: "SBD 6.1 B-BBEE points", ok: true },
  { label: "CIDB Grade 6GB", ok: true },
  { label: "Tax clearance current", ok: true },
  { label: "BCCEI Letter of Good Standing", ok: true },
  { label: "COIDA letter of good standing", ok: false },
];

const Hero = () => (
  <section className="relative pt-36 pb-24 lg:pt-44 lg:pb-32" data-testid="landing-hero">
    <div aria-hidden="true" className="blueprint-grid pointer-events-none absolute inset-0" />
    <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-hero lg:px-10">
      <div>
        <p className="mb-6 inline-flex items-center gap-2 overline-label text-primary">
          <span className="inline-block h-px w-6 bg-primary" />
          SA Tender Compliance · Built for contractors
        </p>
        <h1 className="text-4xl leading-none font-black tracking-tight sm:text-5xl">
          Never lose a bid on a <span className="text-primary">technicality</span> again.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
          Vektor scans SA public tender PDFs in seconds, matches them to your{" "}
          <strong className="whitespace-nowrap text-foreground">CIDB grade</strong>, calculates{" "}
          <strong className="whitespace-nowrap text-foreground">B-BBEE points</strong>, and flags
          every missing SBD form before you submit. What takes an estimator a week takes Vektor 15
          seconds.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Button
            render={
              <Link to="/signup" search={{ ref: undefined }} data-testid="landing-hero-cta" />
            }
            size="lg"
            className="text-base font-bold"
          >
            Start with 5 free analyses
            <ArrowRight aria-hidden="true" />
          </Button>
          <Link
            to="/about"
            data-testid="landing-hero-secondary-cta"
            className="inline-flex items-center gap-2 text-base font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            How Vektor works
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          {["No credit card needed", "Pay by EFT — no gateway fees", "Cancel any time"].map(
            (line) => (
              <span key={line} className="inline-flex items-center gap-2">
                <CheckCircle className="h-4 w-4 fill-primary text-primary" aria-hidden="true" />
                {line}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="relative" data-testid="landing-hero-visual">
        <div className="relative overflow-hidden rounded-sm border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3">
            <div className="h-2.5 w-2.5 rounded-full bg-secondary" />
            <div className="h-2.5 w-2.5 rounded-full bg-secondary" />
            <div className="h-2.5 w-2.5 rounded-full bg-secondary" />
            <span className="ml-3 overline-label text-muted-foreground">
              Analysis · CIDB 6GB · R23.4M
            </span>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="overline-label text-muted-foreground">Go / No-Go</p>
                <p className="mt-1 text-2xl font-bold text-primary">GO — 84%</p>
              </div>
              <div className="text-right">
                <p className="overline-label text-muted-foreground">B-BBEE Points</p>
                <p className="mt-1 text-2xl font-bold text-foreground">18 / 20</p>
              </div>
            </div>
            <div className="space-y-2">
              {HERO_CHECKS.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-sm border border-border bg-background px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  {row.ok ? (
                    <span className="inline-flex items-center gap-1 tight-caps text-primary">
                      <CheckCircle className="h-3 w-3 fill-primary" aria-hidden="true" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 tight-caps text-status-warning">
                      <Clock className="h-3 w-3 fill-status-warning" aria-hidden="true" /> Expiring
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 hidden max-w-xs rounded-sm border border-border bg-background p-4 lg:block">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-status-warning/30 bg-status-warning/10">
              <Bell className="h-4 w-4 text-status-warning" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">COIDA letter expires in 7 days</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Renew before Friday or you&apos;ll be ineligible to bid on this tender.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const SocialProofStrip = () => (
  <section
    className="border-y border-border bg-background py-14"
    data-testid="landing-social-proof"
  >
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <p className="mb-8 overline-label text-center text-muted-foreground">
        Trusted by contractors from Cape Town to Polokwane
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 text-center md:grid-cols-4">
        {[
          { value: "15s", label: "Average analysis time" },
          { value: "R4.2M", label: "Avg tender value screened" },
          { value: "98%", label: "Correct SBD form matches" },
          { value: "0", label: "Missed compliance items" },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-3xl font-black tracking-tight text-foreground lg:text-4xl">
              {stat.value}
            </p>
            <p className="mt-1 label-caps text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const FEATURES = [
  {
    icon: FileText,
    title: "Instant tender parsing",
    body: "Drop any RFP or SBD-packed PDF. Vektor extracts scope, budget, CIDB grade, closing date, and every mandatory returnable in under 15 seconds.",
  },
  {
    icon: ShieldCheck,
    title: "CIDB grade matching",
    body: "Auto-matches the tender to your registered CIDB grades and CoR classes. If you don't qualify, Vektor tells you before you waste hours drafting.",
  },
  {
    icon: ChartLine,
    title: "B-BBEE points calculator",
    body: "Live scoring for the 90/10 or 80/20 preference systems. See exactly how many points your Level earns on this specific tender.",
  },
  {
    icon: FileText,
    title: "SBD 4 & 6.1 auto-generation",
    body: "Vektor pre-fills the SBD 4 declaration and SBD 6.1 B-BBEE affidavit with your company data — including the authorised signatory's name and position. Sign, upload, submit.",
  },
  {
    icon: ShieldCheck,
    title: "Bargaining Council checks",
    body: "Every SA construction tender falls under a sectoral council — BCCEI for civil, NBCEI for electrical, MEIBC for mechanical, regional BIBCs for building. Vektor auto-detects the right one and flags a missing Letter of Good Standing before you submit.",
  },
  {
    icon: Bell,
    title: "Vault & expiry alerts",
    body: "One home for Tax PIN, COIDA, B-BBEE, CIDB and Bargaining Council letters. Vektor emails you at 30, 7, and 0 days before each expires.",
  },
];

const FeaturesSection = () => (
  <section id="features" className="bg-background py-24 lg:py-32" data-testid="landing-features">
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="mb-14 max-w-2xl">
        <p className="mb-4 overline-label text-primary">What you get</p>
        <h2 className="text-4xl leading-none font-black tracking-tight lg:text-5xl">
          Compliance work, <span className="text-primary">done before your coffee cools.</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card
            key={f.title}
            data-testid={`landing-feature-${f.title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            className="rounded-sm border-border shadow-none transition-colors hover:border-primary/50"
          >
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-sm border border-primary/30 bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-lg font-bold">{f.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed">{f.body}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

const STEPS = [
  {
    n: "01",
    title: "Set up your company profile",
    body: "Enter your CIDB grades, B-BBEE level, and CIPC registration once. Vektor uses this on every future analysis.",
  },
  {
    n: "02",
    title: "Upload any tender PDF",
    body: "Drag in the tender document. Vektor reads it, understands it, and shows a compliance scorecard in under 15 seconds.",
  },
  {
    n: "03",
    title: "Fix the flags, submit with confidence",
    body: "One-click SBD form generation, expiry-aware document attachments, and a printable bid pack. Never miss a returnable.",
  },
];

const HowItWorks = () => (
  <section id="how-it-works" className="bg-card py-24 lg:py-32" data-testid="landing-how">
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="mb-14 max-w-2xl">
        <p className="mb-4 overline-label text-primary">How Vektor works</p>
        <h2 className="text-4xl leading-none font-black tracking-tight lg:text-5xl">
          From RFP to submission, <span className="text-primary">in three steps.</span>
        </h2>
      </div>
      <div className="space-y-8 lg:space-y-6">
        {STEPS.map((step) => (
          <Card
            key={step.n}
            data-testid={`landing-step-${step.n}`}
            className="rounded-sm border-border bg-background shadow-none"
          >
            <CardContent className="grid items-start gap-4 p-6 lg:grid-cols-step lg:gap-10 lg:p-8">
              <p aria-hidden="true" className="text-5xl font-black text-primary/70 lg:text-6xl">
                {step.n}
              </p>
              <div>
                <CardTitle className="mb-2 text-xl font-bold lg:text-2xl">{step.title}</CardTitle>
                <CardDescription className="max-w-2xl text-base leading-relaxed">
                  {step.body}
                </CardDescription>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

const TIMELINE_ROWS = [
  { doc: "SARS Tax Clearance PIN", days: 3, level: "critical" as const },
  { doc: "CIDB Grade 6GB Certificate", days: 18, level: "warn" as const },
  { doc: "COIDA Letter of Good Standing", days: 47, level: "ok" as const },
  { doc: "B-BBEE Affidavit (Level 2)", days: 89, level: "ok" as const },
  { doc: "CIPC Company Registration", days: 231, level: "ok" as const },
];

const ProductProofSection = () => (
  <section className="bg-background py-24 lg:py-32" data-testid="landing-proof">
    <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2 lg:gap-24 lg:px-10">
      <div className="order-2 lg:order-1">
        <div className="rounded-sm border border-border bg-card p-6">
          <p className="mb-4 overline-label text-muted-foreground">
            Document Vault · Expiry Timeline
          </p>
          <div className="space-y-3">
            {TIMELINE_ROWS.map((row) => {
              const barClass =
                row.level === "critical"
                  ? "bg-destructive"
                  : row.level === "warn"
                    ? "bg-status-warning"
                    : "bg-primary";
              return (
                <div key={row.doc}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{row.doc}</span>
                    <span
                      className={`tight-caps ${
                        row.level === "critical"
                          ? "text-destructive"
                          : row.level === "warn"
                            ? "text-status-warning"
                            : "text-muted-foreground"
                      }`}
                    >
                      {row.days} days
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, Math.round((row.days / 90) * 100))}
                    aria-label={`${row.doc} expires in ${row.days} days`}
                    className="h-1 gap-0"
                  >
                    <ProgressTrack>
                      <ProgressIndicator className={`h-full ${barClass}`} />
                    </ProgressTrack>
                  </Progress>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="order-1 lg:order-2">
        <p className="mb-4 overline-label text-primary">Compliance vault</p>
        <h2 className="text-4xl leading-none font-black tracking-tight lg:text-5xl">
          Your statutory documents, one calendar away from a lost bid.
        </h2>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground lg:text-lg">
          Vektor tracks every document expiry date and emails you at 30, 7, and 0 days. When a
          tender needs a document you don&rsquo;t have on file, we tell you exactly which one before
          you burn a week drafting the response.
        </p>
        <ul className="mt-8 space-y-3">
          {[
            "Auto-detect document type from filename & content",
            "Regex validation on CIPC, SARS PIN, MAAA, CIDB numbers",
            "Attach any document to a tender bid in one click",
            "Full audit trail — nothing goes missing",
          ].map((line) => (
            <li key={line} className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckCircle
                className="mt-1 h-4 w-4 shrink-0 fill-primary text-primary"
                aria-hidden="true"
              />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

const PLANS = CATALOG.filter((entry) => entry.type === "subscription").map((entry) => ({
  name: entry.name,
  price: formatRand(entry.amount_cents / 100, 0),
  period: "/ month",
  persona: entry.persona,
  credits: `${entry.credits} analyses included`,
  features: [
    entry.tagline,
    "Full PDF audit report",
    PLAN_SUPPORT[entry.lookup_key] ?? "Email support",
  ],
  highlight: entry.is_popular,
  testId: entry.name.toLowerCase(),
}));

const PAYG = CATALOG.find((entry) => entry.type === "one_time");

const PricingSection = () => (
  <section id="pricing" className="bg-card py-24 lg:py-32" data-testid="landing-pricing">
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="mb-14 max-w-2xl">
        <p className="mb-4 overline-label text-primary">Pricing</p>
        <h2 className="text-4xl leading-none font-black tracking-tight lg:text-5xl">
          Every plan comes with <span className="text-primary">every feature.</span>
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          You only pay for how many tenders you analyse. All plans include the vault, SBD forms,
          B-BBEE scoring, and expiry alerts. Pay by EFT direct to our FNB account — zero card fees.
        </p>
      </div>
      <div className="grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <Card
            key={p.name}
            data-testid={`pricing-card-${p.testId}`}
            className={`relative overflow-visible rounded-sm p-6 sm:p-8 ${
              p.highlight ? "border-primary bg-primary/5" : "border-border bg-background"
            }`}
          >
            {p.highlight && (
              <p className="absolute -top-3 left-6 rounded-sm bg-primary px-2 py-1 overline-label text-primary-foreground">
                Most popular
              </p>
            )}
            <p className="mb-1 overline-label text-muted-foreground">{p.name}</p>
            <div className="mb-1 flex items-baseline gap-1">
              <span className="text-3xl font-black text-foreground">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.period}</span>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{p.credits}</p>
            <p className="mb-5 min-h-8 text-xs leading-snug text-muted-foreground">{p.persona}</p>
            <ul className="mb-6 min-h-24 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle
                    className="mt-1 h-3 w-3 shrink-0 fill-primary text-primary"
                    aria-hidden="true"
                  />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              render={
                <Link
                  to="/signup"
                  search={{ ref: undefined }}
                  data-testid={`pricing-cta-${p.testId}`}
                />
              }
              className={`w-full font-bold ${
                p.highlight ? "" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Start free
            </Button>
          </Card>
        ))}
      </div>
      {PAYG && (
        <p className="mt-8 text-xs text-muted-foreground" data-testid="landing-payg-caption">
          Prefer to pay per bid? Grab a{" "}
          <span className="font-semibold text-foreground">
            {PAYG.name} pack for {formatRand(PAYG.amount_cents / 100, 0)}
          </span>{" "}
          — one credit, no subscription, perfect for quick one-off tender checks.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Payments are facilitated by{" "}
        <span className="font-semibold text-muted-foreground">EcoBuiltConnect (Pty) Ltd</span> via
        secure EFT to a First National Bank business account.
      </p>
    </div>
  </section>
);

const PARTNERS = [
  {
    name: "EcoBuiltConnect (Pty) Ltd",
    role: "Payment operations & compliance",
    description:
      "Handles all EFT payment facilitation, transaction reconciliation, and Vektor's day-to-day operational compliance. Vektor is a product operated by EcoBuiltConnect.",
    logo: "/partners/ecobuiltconnect.webp",
    fallbackInitials: "EBC",
    href: "https://www.ecobuiltconnect.co.za",
  },
  {
    name: "EP Technologies",
    role: "Efficiency Power Technologies",
    description:
      "Registration 2022/653768/07 — a South African partner specialising in efficiency power technologies.",
    logo: "/partners/eptechnologies.jpg",
    fallbackInitials: "EPT",
    email: "admin@epinvtech.net",
  },
];

function PartnerLogo({ logo, initials }: { logo?: string; initials: string }) {
  const [broken, setBroken] = useState(false);
  if (!logo || broken) {
    return (
      <div className="flex h-32 items-center justify-center border-b border-primary/30 bg-primary/10">
        <span className="text-4xl font-black tracking-wider text-primary">{initials}</span>
      </div>
    );
  }
  return (
    <div className="flex h-32 min-w-0 items-center justify-center overflow-hidden border-b border-border bg-card px-6 py-4">
      <img
        src={logo}
        alt=""
        className="h-16 w-auto min-w-0 max-w-full object-contain"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

const PartnersSection = () => (
  <section id="partners" className="bg-background py-24 lg:py-32" data-testid="landing-partners">
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="mb-14 max-w-2xl">
        <p className="mb-4 overline-label text-primary">Partners</p>
        <h2 className="text-4xl leading-none font-black tracking-tight lg:text-5xl">
          Backed by trusted South African <span className="text-primary">partners.</span>
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          Vektor is built and operated in partnership with organisations that share our mission of
          raising the bar for South African contractor compliance.
        </p>
      </div>
      <div className="grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
        {PARTNERS.map((p) => (
          <Card
            key={p.name}
            data-testid={`landing-partner-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
            className="overflow-hidden rounded-sm border-border p-0 shadow-none"
          >
            <PartnerLogo logo={p.logo} initials={p.fallbackInitials} />
            <div className="p-6">
              <p className="mb-1 overline-label text-muted-foreground">{p.role}</p>
              <h3 className="mb-2 text-lg font-black leading-tight text-foreground">{p.name}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.description}</p>
              {"href" in p && p.href && (
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`landing-partner-link-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-primary transition-colors hover:text-primary/80"
                >
                  Visit website <ArrowRight aria-hidden="true" />
                </a>
              )}
              {"email" in p && p.email && (
                <a
                  href={`mailto:${p.email}`}
                  data-testid={`landing-partner-email-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-primary transition-colors hover:text-primary/80"
                >
                  {p.email} <ArrowRight aria-hidden="true" />
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

const FAQ = [
  {
    q: "Do I need a payment gateway to buy credits?",
    a: "No. Vektor uses direct EFT to our First National Bank business account. You get a unique reference number, do the EFT from your bank app, upload proof of payment, and we activate your credits within one business day. Zero card fees.",
  },
  {
    q: "How does Vektor know my company's CIDB grade or B-BBEE level?",
    a: "You enter it once during company setup — CIPC number, CIDB grades, B-BBEE level (1–8), and other statutory details. Vektor uses this for every future tender analysis. All data stays in your account and is never shared.",
  },
  {
    q: "What happens if I don't qualify for a tender I upload?",
    a: 'Vektor tells you immediately — usually within 15 seconds. We flag the specific gap (e.g. "needs CIDB Grade 7 CE, you have Grade 5") so you can walk away before wasting time on the response.',
  },
  {
    q: "Are the SBD 4 and SBD 6.1 forms Treasury-compliant?",
    a: "Yes. Vektor pre-fills the current National Treasury SBD 4 (Declaration of Interest) and SBD 6.1 (B-BBEE Preference Points Claim) templates using your company profile. You review, sign, and upload back to the buyer.",
  },
  {
    q: "How current are your compliance rules?",
    a: "We track updates to the PPPFA regulations, CIDB Act amendments, and B-BBEE Codes of Good Practice quarterly. Any change to preference point scoring or mandatory returnables is reflected within 7 days.",
  },
  {
    q: "Can multiple estimators share one account?",
    a: "We're rolling out team seats in the next release. For now, one email per account. If you need multi-user access urgently, email us — we'll set you up manually.",
  },
];

const FaqSection = () => (
  <section id="faq" className="bg-background py-24 lg:py-32" data-testid="landing-faq">
    <div className="mx-auto max-w-4xl px-6 lg:px-10">
      <div className="mb-12">
        <p className="mb-4 overline-label text-primary">Common questions</p>
        <h2 className="text-4xl leading-none font-black tracking-tight lg:text-5xl">
          The important stuff, up front.
        </h2>
      </div>
      <Accordion className="border-y border-border">
        {FAQ.map((row, idx) => (
          <AccordionItem key={row.q} value={row.q} data-testid={`landing-faq-item-${idx}`}>
            <AccordionTrigger className="py-6 text-base font-bold text-foreground hover:text-primary hover:no-underline lg:text-lg">
              {row.q}
            </AccordionTrigger>
            <AccordionContent className="pb-6 text-sm leading-relaxed text-muted-foreground lg:text-base">
              {row.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

const FinalCta = () => (
  <section className="bg-background py-24 lg:py-32" data-testid="landing-final-cta">
    <div className="mx-auto max-w-5xl px-6 lg:px-10">
      <div className="relative overflow-hidden rounded-sm border border-primary/30 bg-gradient-to-br from-card via-background to-card p-10 lg:p-14">
        <div aria-hidden="true" className="brand-glow pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="mb-4 overline-label text-primary">Ready when you are</p>
          <h2 className="max-w-2xl text-4xl leading-none font-black tracking-tight lg:text-5xl">
            Your next bid could go <span className="text-primary">out this afternoon.</span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground lg:text-lg">
            Start with <strong className="text-foreground">5 free tender analyses</strong>. No
            credit card, no setup call, no gateway integration. Just paste in a PDF and see what
            Vektor finds.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              render={
                <Link
                  to="/signup"
                  search={{ ref: undefined }}
                  data-testid="landing-final-cta-btn"
                />
              }
              size="lg"
              className="text-base font-bold"
            >
              Start with 5 free analyses
              <ArrowRight aria-hidden="true" />
            </Button>
            <Link
              to="/login"
              search={{}}
              data-testid="landing-final-cta-signin"
              className="inline-flex items-center gap-2 text-base font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  </section>
);

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; to?: string; href?: string }>;
}) {
  return (
    <div>
      <p className="mb-4 overline-label text-muted-foreground">{title}</p>
      <ul className="space-y-3">
        {links.map((l) =>
          l.to ? (
            <li key={l.label}>
              <Link
                to={l.to}
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                {l.label}
              </Link>
            </li>
          ) : (
            <li key={l.label}>
              <a
                href={l.href}
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                {l.label}
              </a>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

const Footer = () => (
  <footer className="border-t border-border bg-background py-14" data-testid="landing-footer">
    <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-footer lg:px-10">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <VektorMark />
          <span className="text-xl font-bold tracking-tight">Vektor</span>
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Automated tender compliance for South African contractors. Built in Cape Town, made for
          every construction firm from Polokwane to Port Elizabeth.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} EcoBuiltConnect (Pty) Ltd — All rights reserved. Vektor™ is a
          trade mark of EcoBuiltConnect (Pty) Ltd.
        </p>
      </div>
      <FooterCol
        title="Product"
        links={[
          { label: "Features", href: "#features" },
          { label: "Pricing", href: "#pricing" },
          { label: "How it works", href: "#how-it-works" },
          { label: "Partners", href: "#partners" },
        ]}
      />
      <FooterCol
        title="Company"
        links={[
          { label: "About", to: "/about" },
          { label: "Sign in", to: "/login" },
          { label: "Start free", to: "/signup" },
        ]}
      />
      <FooterCol
        title="Legal"
        links={[
          { label: "Terms of Service", to: "/terms" },
          { label: "Privacy Policy", to: "/privacy" },
        ]}
      />
      <FooterCol
        title="Support"
        links={[
          { label: "support@vektorhq.co.za", href: "mailto:support@vektorhq.co.za" },
          { label: "Help & walkthrough", to: "/help" },
        ]}
      />
    </div>
  </footer>
);
