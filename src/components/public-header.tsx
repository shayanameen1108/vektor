import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";

import { VektorMark } from "@/components/vektor-mark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const MOBILE_LINKS = [
  { to: "/about" as const, label: "About", key: "about" },
  { to: "/help" as const, label: "Help", key: "help" },
  { to: "/terms" as const, label: "Terms", key: "terms" },
  { to: "/privacy" as const, label: "Privacy", key: "privacy" },
] as const;

export function PublicHeader({
  testId,
  brandTestId,
  children,
}: {
  testId: string;
  brandTestId: string;
  children: ReactNode;
}) {
  return (
    <header data-testid={testId} className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
        <Link to="/" data-testid={brandTestId} className="flex items-center gap-2.5">
          <VektorMark className="h-7 w-7" />
          <span className="text-xl font-bold tracking-tight">Vektor</span>
        </Link>
        <div className="hidden lg:flex lg:items-center">{children}</div>
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                data-testid={`${testId}-mobile-menu`}
                aria-label="Open menu"
                className="lg:hidden !size-11"
              />
            }
          >
            <Menu aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72" data-testid={`${testId}-mobile-sheet`}>
            <SheetHeader>
              <SheetTitle>Vektor</SheetTitle>
            </SheetHeader>
            <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
              {MOBILE_LINKS.map((item) => (
                <SheetClose
                  key={item.key}
                  nativeButton={false}
                  render={
                    <Link
                      to={item.to}
                      data-testid={`${testId}-mobile-${item.key}`}
                      className="rounded-sm px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  }
                />
              ))}
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    to="/login"
                    search={{}}
                    data-testid={`${testId}-mobile-login`}
                    className="rounded-sm px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
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
                        data-testid={`${testId}-mobile-signup`}
                      />
                    }
                    className="mt-2 w-full font-bold"
                  >
                    Start free
                  </Button>
                }
              />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
