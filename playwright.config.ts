import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Serial everywhere: two engines × N workers hammering one workerd/D1
  // instance causes cross-test slowness spikes that show up as flakes. The
  // gate must be deterministic — pass --workers=N on the CLI for quick local
  // iteration if you accept that trade-off.
  workers: 1,
  reporter: "list",
  // Headroom for load spikes when two engines run in parallel against one
  // workerd instance; individual long journeys override via test.setTimeout.
  timeout: 60_000,
  use: {
    // Override with E2E_BASEURL=https://<preview>.workers.dev to run specs
    // (including the smoke journey) against a `wrangler versions upload` preview
    baseURL: process.env.E2E_BASEURL ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    // Keeps Chrome's save-password bubble and autofill UI from covering the
    // auth controls these specs click. (Historically these flags were credited
    // with fixing intermittent auth-page contrast violations; those were really
    // axe measuring the page before styles.css applied, which
    // expectNoA11yViolations() in tests/e2e/helpers.ts now guards.)
    launchOptions: {
      args: [
        "--disable-features=PasswordManager,AutofillServerCommunication,PasswordManagerOnboarding",
        "--disable-save-password-bubble",
        "--autofill-test-by-default=false",
      ],
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: /mobile\.spec\.ts/ },
    {
      // Touch + short-viewport behaviour (off-canvas nav, date picker, dialog
      // reachability) that neither desktop width exercises. Scoped to its own
      // spec: the desktop specs assume wide layouts, and a third full pass
      // would triple runtime against the single workerd instance for no gain.
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.E2E_BASEURL
    ? undefined
    : {
        command: "nub run preview --host 127.0.0.1 --port 4173 --strictPort",
        reuseExistingServer: process.env.E2E_REUSE === "1" && !process.env.CI,
        stderr: "pipe",
        stdout: "pipe",
        timeout: 120_000,
        url: "http://127.0.0.1:4173",
      },
});
