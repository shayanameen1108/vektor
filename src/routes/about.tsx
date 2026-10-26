import { createFileRoute, Link } from "@tanstack/react-router";
import { HandshakeIcon, SearchIcon } from "lucide-react";

import { BargainingCouncilTable } from "@/components/bargaining-council-table";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const HOW_WE_HELP = [
  {
    title: "Stay ready — don't scramble",
    body: "Continuous compliance monitoring so you're never caught off-guard when a tender drops.",
    testId: "about-help-stay",
  },
  {
    title: "Surface risks before they cost you",
    body: "Automated analysis flags expired documents, missing forms, and disqualifying details in seconds.",
    testId: "about-help-surface",
  },
  {
    title: "Turn complexity into clear next steps",
    body: "We translate legal requirements and SBD forms into an actionable checklist — no guesswork.",
    testId: "about-help-turn",
  },
  {
    title: "Confidence when opportunity appears",
    body: "Know your house is in order every time a bid deadline shows up. Focus on the price, not the paperwork.",
    testId: "about-help-confidence",
  },
];

const PROMISE = [
  { label: "Clear compliance", testId: "about-promise-clear" },
  { label: "Fewer disqualifications", testId: "about-promise-fewer" },
  { label: "More time winning work", testId: "about-promise-more" },
];

function AboutPage() {
  return (
    <div className="min-h-svh bg-background" data-testid="about-page">
      <PublicHeader testId="about-header" brandTestId="about-brand-link">
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            search={{}}
            data-testid="about-login-link"
            className="px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Button
            render={
              <Link to="/signup" search={{ ref: undefined }} data-testid="about-signup-link" />
            }
            size="sm"
          >
            Create free account
          </Button>
        </div>
      </PublicHeader>

      <main>
        <section className="bg-background text-foreground">
          <div className="mx-auto max-w-4xl px-6 py-20 lg:py-28">
            <p className="mb-4 overline-label text-primary">About Vektor</p>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl">
              Why We Built <span className="text-primary">Vektor</span>
            </h1>
            <p className="mt-8 max-w-3xl text-lg leading-relaxed text-muted-foreground">
              Winning a government tender in South Africa shouldn&rsquo;t feel like navigating a
              minefield of expired documents, mismatched forms, and last-minute compliance panic.
            </p>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
              Yet that&rsquo;s exactly what most SMMEs experience. They lose tenders not because
              they&rsquo;re incapable — but because of technicalities. An outdated{" "}
              <strong className="text-foreground">B-BBEE affidavit</strong>. A missing signature on
              an <strong className="text-foreground">SBD form</strong>. A{" "}
              <strong className="text-foreground">CSD status</strong> that slipped. A{" "}
              <strong className="text-foreground">Tax Compliance PIN</strong> that expired three
              days before closing.
            </p>
            <p className="mt-4 max-w-3xl text-lg font-semibold leading-relaxed text-foreground">
              We built Vektor because we believe South African businesses deserve better.
            </p>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 py-16 md:grid-cols-3 lg:py-20">
            <div className="md:col-span-1">
              <p className="overline-label text-muted-foreground">The problem</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                Capable companies, disqualified on technicalities.
              </h2>
            </div>
            <div className="space-y-4 leading-relaxed text-foreground md:col-span-2">
              <p>
                Every year, thousands of capable companies get disqualified before their price or
                capability is even considered. The process is complex, the rules keep changing, and
                the cost of one small mistake is high.
              </p>
              <p className="font-semibold text-foreground">
                Vektor exists to remove that friction.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <div className="max-w-2xl">
              <p className="overline-label text-primary">How we help</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                We act as your Compliance Guide.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Vektor turns the four highest-cost pain points in SA tender compliance into a live,
                proactive dashboard.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
              {HOW_WE_HELP.map((item) => (
                <Card
                  key={item.title}
                  data-testid={item.testId}
                  className="flex flex-row gap-4 rounded-sm border-border p-6 shadow-none"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 text-primary">
                    <span aria-hidden>✓</span>
                  </div>
                  <CardContent className="p-0">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <CardDescription className="mt-1.5 text-sm leading-relaxed">
                      {item.body}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 py-16 md:grid-cols-3 lg:py-20">
            <div className="md:col-span-1">
              <p className="overline-label text-muted-foreground">Who we serve</p>
              <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-sm bg-muted text-foreground">
                <HandshakeIcon aria-hidden="true" />
              </div>
            </div>
            <div className="space-y-4 leading-relaxed text-foreground md:col-span-2">
              <p className="text-2xl font-bold leading-tight tracking-tight text-foreground">
                We built Vektor for the serious South African business.
              </p>
              <p>
                The contractor, consultant, supplier, and service provider who wants to compete
                fairly and win more work from government.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card" data-testid="about-bargaining-section">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <p className="overline-label text-primary">Compliance context</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Know your Bargaining Council before you bid.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Every SA construction tender falls under a sectoral bargaining council. You must be
              registered and hold a current Letter of Good Standing or you risk disqualification
              even when every other document is perfect.
            </p>
            <BargainingCouncilTable variant="about" />
            <p className="mt-4 text-sm text-muted-foreground">
              Manage your Letters of Good Standing in the{" "}
              <Link
                to="/documents"
                data-testid="about-vault-link"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                Document Vault
              </Link>{" "}
              and learn more in{" "}
              <Link
                to="/help"
                data-testid="about-help-link"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                Help &amp; Guides
              </Link>
              .
            </p>
            <div className="mt-6 rounded-sm border border-border bg-card p-4">
              <h3 className="text-sm font-bold tracking-tight">Official verification portals</h3>
              <ul className="mt-3 list-disc space-y-1 pl-6 text-sm">
                <li>
                  <a
                    href="https://esearch.cipc.co.za/"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="about-cipc-link"
                    className="font-semibold text-foreground underline underline-offset-2"
                  >
                    CIPC eSearch — verify company registration ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://secure.csd.gov.za/"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="about-csd-link"
                    className="font-semibold text-foreground underline underline-offset-2"
                  >
                    National Treasury CSD (MAAA) portal ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://tools.sars.gov.za/tcc/"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="about-sars-link"
                    className="font-semibold text-foreground underline underline-offset-2"
                  >
                    SARS Tax Compliance Status portal ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://registers.cidb.org.za/"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="about-cidb-link"
                    className="font-semibold text-foreground underline underline-offset-2"
                  >
                    CIDB Registers of Contractors — verify grade &amp; class ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.bccei.co.za"
                    target="_blank"
                    rel="noreferrer"
                    data-testid="about-bccei-link"
                    className="font-semibold text-foreground underline underline-offset-2"
                  >
                    BCCEI — Civil Engineering ↗
                  </a>
                  {" · "}
                  <a
                    href="https://www.nbcei.co.za"
                    target="_blank"
                    rel="noreferrer"
                    data-testid="about-inline-nbcei"
                    className="font-semibold text-foreground underline underline-offset-2"
                  >
                    NBCEI ↗
                  </a>
                  {" · "}
                  <a
                    href="https://www.meibc.co.za"
                    target="_blank"
                    rel="noreferrer"
                    data-testid="about-inline-meibc"
                    className="font-semibold text-foreground underline underline-offset-2"
                  >
                    MEIBC ↗
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-background text-foreground">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="overline-label text-primary">Our promise</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything a South African contractor needs to bid with confidence.
              </h2>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
              {PROMISE.map((p) => (
                <div
                  key={p.label}
                  data-testid={p.testId}
                  className="rounded-sm border border-border bg-card p-6 text-center"
                >
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-sm border border-primary/40 bg-primary/15 text-primary">
                    <span aria-hidden>●</span>
                  </div>
                  <p className="mt-4 font-semibold text-foreground">{p.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center lg:py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to stop losing tenders on technicalities?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Start with 5 free tender analyses on signup. No card required.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                render={
                  <Link to="/signup" search={{ ref: undefined }} data-testid="about-cta-signup" />
                }
                size="lg"
                className="w-full sm:w-auto"
              >
                Create free account{" "}
                <span aria-hidden className="ml-2">
                  →
                </span>
              </Button>
              <Button
                render={<Link to="/login" search={{}} data-testid="about-cta-login" />}
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
              >
                Sign in
              </Button>
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 label-caps text-muted-foreground">
              <SearchIcon aria-hidden="true" /> Built for South African contractors
            </p>
          </div>
        </section>
      </main>

      <PublicFooter testIdPrefix="about" />
    </div>
  );
}
