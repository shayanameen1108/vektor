import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { createCompany, signUp, TEST_PASSWORD, uniqueEmail, waitForHydration } from "./helpers";

// V06: an identity switch inside one tab must never show the previous user's
// cached private data. The real sign-out menu and login form are driven on the
// same document — never page.goto — so the tab's QueryClient genuinely
// survives the switch.

const A_COMPANY = { name: "Same-Tab Alpha Holdings (Pty) Ltd", cipc: "2026/111111/07" };
const B_COMPANY = { name: "Same-Tab Beta Industries (Pty) Ltd", cipc: "2026/222222/07" };

/** Sign out through the real sidebar menu; SPA navigation keeps this document. */
async function sidebarSignOut(page: Page) {
  await page.getByTestId("user-menu-trigger").click();
  await page.getByTestId("btn-signout").click();
  await expect(page.getByTestId("login-form")).toBeVisible({ timeout: 20000 });
  await waitForHydration(page, "login-form");
}

/** Sign in on the already-rendered login form — no reload, no goto. */
async function spaSignIn(page: Page, email: string) {
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(TEST_PASSWORD);
  await page.getByTestId("submit-login").click();
}

/** The marker the switch must never render again. */
declare global {
  interface Window {
    __v06Document?: string;
    __v06Leak?: string[];
  }
}

/** One rendered frame; the leak observer latches on the first mutation. */
async function settleFrame(page: Page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

for (const mode of ["cached", "in-flight"] as const) {
  test(`an identity switch in one tab never shows the previous user's data (${mode})`, async ({
    page,
    browser,
  }) => {
    // B exists first, in its own context — signUp/createCompany's page.goto is
    // fine for fixture setup; the measured switch below never navigates.
    const bEmail = uniqueEmail("v06-beta");
    const bContext = await browser.newContext();
    const bPage = await bContext.newPage();
    try {
      await signUp(bPage, "Beta Owner", { email: bEmail });
      await createCompany(bPage, {
        name: B_COMPANY.name,
        cipc: B_COMPANY.cipc,
        contactEmail: bEmail,
      });
    } finally {
      await bContext.close();
    }

    // A signs up and creates its company through the public UI.
    const aEmail = uniqueEmail("v06-alpha");
    await signUp(page, "Alpha Owner", { email: aEmail });
    await createCompany(page, {
      name: A_COMPANY.name,
      cipc: A_COMPANY.cipc,
      contactEmail: aEmail,
    });
    await page.evaluate(() => {
      window.__v06Document = "same-tab";
    });

    // A's own EFT reference through the public API (no payment is confirmed).
    const companiesRes = await page.request.get("/api/companies");
    expect(companiesRes.ok()).toBe(true);
    const companies = (await companiesRes.json()) as { id: string }[];
    expect(companies[0]?.id).toBeTruthy();
    const eftRes = await page.request.post("/api/eft/request", {
      data: { company_id: companies[0]!.id, lookup_key: "tc_starter_monthly_v2" },
    });
    expect(eftRes.ok()).toBe(true);
    const aPayment = (await eftRes.json()) as { reference?: string };
    expect(aPayment.reference).toMatch(/^VEK-[A-HJ-NP-Z2-9]{6}$/);
    const aReference = aPayment.reference as string;

    const heldReleases: (() => void)[] = [];
    let releaseCompanies: () => void = () => {};
    let heldAResponse: APIResponse | null = null;
    let heldRequest: import("@playwright/test").Request | null = null;
    // What became of the held A response once released: "delivered" means the
    // fulfill landed, "aborted" means the request was torn down first —
    // either way nothing may repopulate the cache the next user sees.
    let heldOutcome: "pending" | "delivered" | "aborted" | "error" = "pending";
    let sawHeldAbort = false;
    page.on("requestfailed", (request) => {
      if (
        heldRequest &&
        request === heldRequest &&
        request.failure()?.errorText === "net::ERR_ABORTED"
      )
        sawHeldAbort = true;
    });
    try {
      if (mode === "in-flight") {
        // Hold only the first — A's own — my-requests response. The flag drops
        // before route.fetch so B's later requests proceed normally.
        let holdNext = true;
        await page.route("**/api/eft/my-requests", async (route) => {
          if (!holdNext) return route.fallback();
          holdNext = false;
          heldRequest = route.request();
          const response = await route.fetch();
          heldAResponse = response;
          await new Promise<void>((release) => heldReleases.push(release));
          try {
            await route.fulfill({ response });
            heldOutcome = "delivered";
          } catch {
            heldOutcome = sawHeldAbort ? "aborted" : "error";
          }
        });
      }

      // Open Billing so A's EFT list is cached — or in flight for this run.
      // my-requests is a plain useQuery: while the response is held the query
      // stays pending in the shared cache, and the sidebar sign-out remains.
      await page.getByTestId("nav-billing").click();
      if (mode === "cached") {
        await expect(page.getByTestId("my-eft-payments-section")).toBeVisible();
        await expect(page.getByTestId("my-eft-payments-section")).toContainText(aReference);
        await page.waitForLoadState("networkidle");
      } else {
        // The first captured response is really A's list before we sign out.
        await expect.poll(() => heldAResponse, { timeout: 15000 }).not.toBeNull();
        expect(heldAResponse!.ok()).toBe(true);
        expect(await heldAResponse!.text()).toContain(aReference);
      }

      // Freeze only Date: the 30s staleTime never elapses, so a "fresh" cache
      // stays fresh for the whole switch instead of racing a wall clock.
      await page.clock.install();
      await page.clock.setFixedTime(new Date());

      await sidebarSignOut(page);
      // The document — and the QueryClient — survived the sign-out.
      expect(await page.evaluate(() => window.__v06Document)).toBe("same-tab");

      // Gate B's companies fetch: if B renders any company before release, it
      // can only have come from A's cache (a cache hit may never fetch at all,
      // so nothing here waits for the gated request to be made).
      const companiesHeld = new Promise<void>((resolve) => {
        releaseCompanies = resolve;
      });
      await page.route("**/api/companies", async (route) => {
        await companiesHeld;
        await route.fallback();
      });

      // Latch any of A's markers the moment they enter the rendered text.
      await page.evaluate(
        ([name, cipc, reference]) => {
          window.__v06Leak = [];
          const markers = [name, cipc, reference].filter(Boolean) as string[];
          const scan = () => {
            const text = document.body.innerText;
            for (const marker of markers)
              if (text.includes(marker) && !window.__v06Leak!.includes(marker))
                window.__v06Leak!.push(marker);
          };
          new MutationObserver(scan).observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
          });
          scan();
        },
        [A_COMPANY.name, A_COMPANY.cipc, aReference],
      );

      await spaSignIn(page, bEmail);
      await expect(page.getByTestId("user-email")).toHaveText(bEmail, { timeout: 20000 });
      // Still the same document after the whole sign-out/sign-in round trip.
      expect(await page.evaluate(() => window.__v06Document)).toBe("same-tab");
      // B's own companies are still gated — any A marker now is a cache leak.
      await settleFrame(page);
      expect(await page.evaluate(() => window.__v06Leak)).toEqual([]);

      releaseCompanies();
      await page.unroute("**/api/companies");
      await expect(page.getByTestId("company-info")).toContainText(B_COMPANY.name, {
        timeout: 20000,
      });

      // Billing by SPA nav; the held A EFT response is released only now.
      // Whatever became of it — delivered into a cleared cache or aborted —
      // may not repopulate anything the new user's page renders.
      await page.getByTestId("nav-billing").click();
      await expect(page.getByTestId("my-eft-payments-section")).toBeVisible({
        timeout: 20000,
      });
      if (mode === "in-flight") {
        heldReleases.forEach((release) => release());
        await expect.poll(() => heldOutcome, { timeout: 15000 }).not.toBe("pending");
        test.info().annotations.push({ type: "v06-held-response", description: heldOutcome });
        expect(["delivered", "aborted"]).toContain(heldOutcome);
        await page.unroute("**/api/eft/my-requests");
      }
      await expect(page.getByTestId("my-eft-payments-section")).not.toContainText(aReference);
      await settleFrame(page);
      expect(await page.evaluate(() => window.__v06Leak)).toEqual([]);
    } finally {
      releaseCompanies();
      heldReleases.forEach((release) => release());
    }
  });
}
