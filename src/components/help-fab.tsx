import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRightIcon, CircleQuestionMarkIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Floating help button with context-aware tips and a link into the full guide.
 * Hidden on marketing, auth, and admin surfaces.
 */
const PAGE_TIPS: Record<string, { title: string; tips: string[] }> = {
  "/app": {
    title: "Dashboard tips",
    tips: [
      "Your credit balance and active company are shown in the sidebar.",
      "Recent tender analyses appear here — each row shows its Fit Score.",
      "Start a new analysis from the Analyze Tender tab.",
    ],
  },
  "/setup": {
    title: "Setting up your company",
    tips: [
      "CIPC format: YYYY/NNNNNN/TT — we auto-derive your incorporation year.",
      "SARS TCS PIN: 9–10 alphanumeric chars. Case is normalised automatically.",
      "CSD MAAA: 'MAAA' + 7 digits (case-insensitive).",
      "Each field links to its official verification portal.",
    ],
  },
  "/documents": {
    title: "Managing your vault",
    tips: [
      "Upload PDFs, JPGs or PNGs of your compliance documents.",
      "Set the expiry date — anything within 30 days shows amber.",
      "Compliance status feeds the disqualification risk flags in tender analysis.",
    ],
  },
  "/analyze": {
    title: "Running an analysis",
    tips: [
      "One tender analysis = 1 credit (refunded if extraction fails).",
      "Only PDF files are accepted. The first 20 pages are analysed.",
      "Choose 80/20 (< R50m) or 90/10 (> R50m) preference-point system.",
    ],
  },
  "/billing": {
    title: "Credits & subscriptions",
    tips: [
      "New companies get 5 free analysis credits on signup.",
      "Pay by EFT — credits are added once an admin verifies your deposit.",
      "Subscribers keep unused credits, up to 2× their monthly allowance.",
    ],
  },
};

const DEFAULT_TIPS = {
  title: "Need a hand?",
  tips: [
    "Open the full guide for the walkthrough and feature reference.",
    "Every field in the app has an official-portal deep-link where relevant.",
  ],
};

const HIDDEN_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password", "/admin"];
const HIDDEN_EXACT = ["/", "/about", "/terms", "/privacy", "/help"];

export function HelpFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (HIDDEN_EXACT.includes(pathname) || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  const key = Object.keys(PAGE_TIPS).find((p) => pathname.startsWith(p));
  const ctx = key ? PAGE_TIPS[key]! : DEFAULT_TIPS;

  return (
    <>
      <Button
        type="button"
        data-testid="help-fab"
        onClick={() => setOpen(true)}
        aria-label="Open help drawer"
        size="icon"
        className="fixed right-6 bottom-6 z-40 size-12 rounded-sm"
      >
        <CircleQuestionMarkIcon className="size-5" aria-hidden="true" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full max-w-md gap-0 p-0 sm:max-w-md"
          data-testid="help-drawer"
        >
          <SheetHeader className="border-b border-border p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="overline-label mb-1 text-muted-foreground">Contextual help</p>
                <SheetTitle className="text-lg font-bold" data-testid="help-drawer-title">
                  {ctx.title}
                </SheetTitle>
              </div>
              <SheetClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-testid="help-drawer-close"
                    aria-label="Close help"
                  />
                }
              >
                <XIcon aria-hidden="true" />
              </SheetClose>
            </div>
            <SheetDescription className="sr-only">
              Context-aware tips for this page.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-auto p-6">
            <ul className="space-y-3">
              {ctx.tips.map((t, i) => (
                <li
                  key={t}
                  data-testid={`help-drawer-tip-${i}`}
                  className="flex gap-3 text-sm leading-relaxed text-foreground"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <SheetFooter className="border-t border-border bg-muted p-6">
            <Button
              type="button"
              data-testid="help-drawer-open-full-guide"
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/help" });
              }}
              className="w-full"
            >
              Open the full guide &amp; walkthrough
              <ArrowRightIcon aria-hidden="true" />
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
