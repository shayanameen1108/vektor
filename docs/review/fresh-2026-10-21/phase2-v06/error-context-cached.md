# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: session-isolation.spec.ts >> an identity switch in one tab never shows the previous Account's data (cached)
- Location: tests/e2e/session-isolation.spec.ts:32:3

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "Same-Tab Alpha Holdings (Pty) Ltd",
+   "2026/111111/07",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - generic [ref=e2]:
        - navigation "Vektor navigation" [ref=e6]:
            - generic [ref=e7]:
                - generic [ref=e8]: Vektor
                - paragraph [ref=e11]: SA Tender Compliance
            - list [ref=e15]:
                - listitem [ref=e16]:
                    - link "Dashboard" [ref=e17] [cursor=pointer]:
                        - /url: /app
                - listitem [ref=e22]:
                    - link "Analyze Tender" [ref=e23] [cursor=pointer]:
                        - /url: /analyze
                - listitem [ref=e28]:
                    - link "Document Vault" [ref=e29] [cursor=pointer]:
                        - /url: /documents
                - listitem [ref=e34]:
                    - link "Company Setup" [ref=e35] [cursor=pointer]:
                        - /url: /setup
                - listitem [ref=e40]:
                    - link "Billing & Credits" [ref=e41] [cursor=pointer]:
                        - /url: /billing
                - listitem [ref=e45]:
                    - link "Help & Guides" [ref=e46] [cursor=pointer]:
                        - /url: /help
                - listitem [ref=e51]:
                    - link "About Vektor" [ref=e52] [cursor=pointer]:
                        - /url: /about
            - generic [ref=e56]:
                - paragraph [ref=e63]: Credits
                - paragraph [ref=e64]: "5"
                - paragraph [ref=e65]: tender analyses available
            - generic [ref=e66]:
                - paragraph [ref=e67]: Active Company
                - paragraph [ref=e68]: Same-Tab Alpha Holdings (Pty) Ltd
                - paragraph [ref=e69]: "CIPC: 2026/111111/07"
            - button "BO v06-beta.1792601838094.dwhc49@example.com" [ref=e72]:
                - generic [ref=e73]: BO
                - generic [ref=e75]: v06-beta.1792601838094.dwhc49@example.com
        - main [ref=e76]:
            - generic [ref=e77]:
                - generic [ref=e79]:
                    - generic [ref=e80]:
                        - paragraph [ref=e81]: Dashboard
                        - heading "Same-Tab Alpha Holdings (Pty) Ltd" [level=1] [ref=e82]
                    - button "Analyze New Tender" [ref=e83] [cursor=pointer]
                - generic [ref=e84]:
                    - alert [ref=e85]:
                        - generic [ref=e86]:
                            - generic [ref=e87]: Credits
                            - generic [ref=e88]: "5"
                            - generic [ref=e89]: available
                            - link "Manage billing →" [ref=e90] [cursor=pointer]:
                                - /url: /billing
                    - generic [ref=e91]:
                        - generic [ref=e92]:
                            - generic [ref=e93]: B-BBEE Level
                            - generic [ref=e95]:
                                - generic [ref=e96]: N/A
                                - paragraph [ref=e97]: Preference points
                        - generic [ref=e98]:
                            - generic [ref=e99]: CIDB Grade
                            - generic [ref=e101]:
                                - generic [ref=e102]: Not Set
                                - paragraph [ref=e103]: Registered grades & classes
                        - generic [ref=e104]:
                            - generic [ref=e105]: Compliance Status
                            - generic [ref=e107]:
                                - generic [ref=e108]: 0/0
                                - paragraph [ref=e109]: Documents compliant
                        - generic [ref=e110]:
                            - generic [ref=e111]: Avg Fit Score
                            - generic [ref=e113]:
                                - generic [ref=e114]: —
                                - paragraph [ref=e115]: Across 0 tenders
                    - generic [ref=e116]:
                        - generic [ref=e117]:
                            - generic [ref=e118]: Recent Activity
                            - generic [ref=e119]: Last 8
                        - tablist "Activity filter" [ref=e121]:
                            - tab "All" [selected] [ref=e122]
                            - tab "Tenders" [ref=e123]
                            - tab "Payments" [ref=e124]
                            - tab "Referrals" [ref=e125]
                        - generic [ref=e129]:
                            - generic [ref=e131]: No activity yet
                            - generic [ref=e132]: Nothing to show yet. Analyze a tender or invite someone to Vektor to get started.
                    - generic [ref=e133]:
                        - generic [ref=e134]: Recent Tender Analyses
                        - generic [ref=e138]:
                            - generic [ref=e139]:
                                - generic [ref=e141]: No tenders analyzed yet
                                - generic [ref=e142]: Upload a tender PDF to get started.
                            - button "Analyze a tender" [ref=e144] [cursor=pointer]
                    - generic [ref=e145]:
                        - button "Manage Documents Upload and track compliance documents" [ref=e146] [cursor=pointer]:
                            - generic [ref=e147]:
                                - generic [ref=e148]: Manage Documents
                                - generic [ref=e149]: Upload and track compliance documents
                        - button "Edit Company Profile Update CIPC, CIDB, and B-BBEE details" [ref=e150] [cursor=pointer]:
                            - generic [ref=e151]:
                                - generic [ref=e152]: Edit Company Profile
                                - generic [ref=e153]: Update CIPC, CIDB, and B-BBEE details
                        - button "Billing & Credits View credits and EFT payments" [ref=e154] [cursor=pointer]:
                            - generic [ref=e155]:
                                - generic [ref=e156]: Billing & Credits
                                - generic [ref=e157]: View credits and EFT payments
    - button "Open help drawer" [ref=e158]
    - region "Notifications alt+T":
        - list:
            - listitem [ref=e159]:
                - generic [ref=e164]: Welcome back
            - listitem [ref=e166]:
                - generic [ref=e171]: Signed out
            - listitem [ref=e173]:
                - generic [ref=e178]: Company profile created successfully!
            - listitem:
                - generic: Account created — welcome to Vektor
    - button "Open TanStack Devtools" [ref=e180] [cursor=pointer]
```

# Test source

```ts
  52  |     // A signs up and creates its company through the public UI.
  53  |     const aEmail = uniqueEmail("v06-alpha");
  54  |     await signUp(page, "Alpha Owner", { email: aEmail });
  55  |     await createCompany(page, {
  56  |       name: A_COMPANY.name,
  57  |       cipc: A_COMPANY.cipc,
  58  |       contactEmail: aEmail,
  59  |     });
  60  |
  61  |     // Mark this document so the switch can prove it never reloaded.
  62  |     await page.evaluate(() => {
  63  |       (window as unknown as Record<string, unknown>).__v06Document = "same-tab";
  64  |     });
  65  |
  66  |     // A's own EFT reference through the public API (no payment is confirmed).
  67  |     const companies = (await (await page.request.get("/api/companies")).json()) as {
  68  |       id: string;
  69  |     }[];
  70  |     const aPayment = (await (
  71  |       await page.request.post("/api/eft/request", {
  72  |         data: { company_id: companies[0]!.id, lookup_key: "tc_starter_monthly_v2" },
  73  |       })
  74  |     ).json()) as { reference: string };
  75  |     const aReference = aPayment.reference;
  76  |
  77  |     const heldReleases: (() => void)[] = [];
  78  |     let releaseCompanies: () => void = () => {};
  79  |     let eftRequested = false;
  80  |     try {
  81  |       if (mode === "in-flight") {
  82  |         // Fetch A's real EFT list but hold the fulfillment so it lands only
  83  |         // after B is signed in — the pending query stays in the shared cache.
  84  |         await page.route("**/api/eft/my-requests", async (route) => {
  85  |           eftRequested = true;
  86  |           const response = await route.fetch();
  87  |           await new Promise<void>((release) => heldReleases.push(release));
  88  |           await route.fulfill({ response });
  89  |         });
  90  |       }
  91  |
  92  |       // Open Billing so A's EFT list is cached — or in flight for this run.
  93  |       // The route's loader awaits the list, so while it is held the page sits
  94  |       // on its Loading fallback; the sidebar (and its sign-out) stays mounted.
  95  |       await page.getByTestId("nav-billing").click();
  96  |       if (mode === "cached") {
  97  |         await expect(page.getByTestId("my-eft-payments-section")).toBeVisible();
  98  |         await expect(page.getByTestId("my-eft-payments-section")).toContainText(aReference);
  99  |         await page.waitForLoadState("networkidle");
  100 |       } else {
  101 |         await expect.poll(() => eftRequested, { timeout: 15000 }).toBe(true);
  102 |       }
  103 |
  104 |       // Freeze only Date: the 30s staleTime never elapses, so a "fresh" cache
  105 |       // stays fresh for the whole switch instead of racing a wall clock.
  106 |       await page.clock.install();
  107 |       await page.clock.setFixedTime(new Date());
  108 |
  109 |       await sidebarSignOut(page);
  110 |       // The document — and the QueryClient — survived the sign-out.
  111 |       expect(await page.evaluate(() => (window as any).__v06Document)).toBe("same-tab");
  112 |
  113 |       // Gate B's companies fetch: if B renders any company before release, it
  114 |       // can only have come from A's cache (a cache hit may never fetch at all,
  115 |       // so nothing here waits for the gated request to be made).
  116 |       const companiesHeld = new Promise<void>((resolve) => {
  117 |         releaseCompanies = resolve;
  118 |       });
  119 |       await page.route("**/api/companies", async (route) => {
  120 |         await companiesHeld;
  121 |         await route.fallback();
  122 |       });
  123 |
  124 |       // Latch any of A's markers the moment they enter the rendered text.
  125 |       await page.evaluate(
  126 |         ([name, cipc, reference]) => {
  127 |           const w = window as unknown as Record<string, unknown>;
  128 |           w.__v06Leak = [] as string[];
  129 |           const markers = [name, cipc, reference].filter(Boolean) as string[];
  130 |           const scan = () => {
  131 |             const text = document.body.innerText;
  132 |             for (const marker of markers)
  133 |               if (text.includes(marker) && !(w.__v06Leak as string[]).includes(marker))
  134 |                 (w.__v06Leak as string[]).push(marker);
  135 |           };
  136 |           new MutationObserver(scan).observe(document.body, {
  137 |             childList: true,
  138 |             subtree: true,
  139 |             characterData: true,
  140 |           });
  141 |           scan();
  142 |         },
  143 |         [A_COMPANY.name, A_COMPANY.cipc, aReference],
  144 |       );
  145 |
  146 |       await spaSignIn(page, bEmail);
  147 |       await expect(page.getByTestId("user-email")).toHaveText(bEmail, { timeout: 20000 });
  148 |       // B's own companies are still gated — any A marker now is a cache leak.
  149 |       // The held request means no network idle; the observer latches on the
  150 |       // first mutation, so a bounded settle proves nothing of A's rendered.
  151 |       await page.waitForTimeout(1000);
> 152 |       expect(await page.evaluate(() => (window as any).__v06Leak)).toEqual([]);
      |                                                                    ^ Error: expect(received).toEqual(expected) // deep equality
  153 |
  154 |       releaseCompanies();
  155 |       await page.unroute("**/api/companies");
  156 |       await expect(page.getByTestId("company-info")).toContainText(B_COMPANY.name, {
  157 |         timeout: 20000,
  158 |       });
  159 |
  160 |       // Billing by SPA nav; the held A EFT response lands only now, so B's
  161 |       // billing loader unblocks with whatever the shared query resolves to.
  162 |       await page.getByTestId("nav-billing").click();
  163 |       if (mode === "in-flight") {
  164 |         heldReleases.forEach((release) => release());
  165 |         await page.unroute("**/api/eft/my-requests");
  166 |       }
  167 |       await expect(page.getByTestId("my-eft-payments-section")).toBeVisible({
  168 |         timeout: 20000,
  169 |       });
  170 |       await page.waitForLoadState("networkidle");
  171 |       await expect(page.getByTestId("my-eft-payments-section")).not.toContainText(aReference);
  172 |       expect(await page.evaluate(() => (window as any).__v06Leak)).toEqual([]);
  173 |     } finally {
  174 |       releaseCompanies();
  175 |       heldReleases.forEach((release) => release());
  176 |     }
  177 |   });
  178 | }
  179 |
```
