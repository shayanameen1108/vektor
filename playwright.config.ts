import { defineConfig } from "@playwright/test";

/**
 * Keeps Chrome's save-password bubble and autofill UI from covering the auth
 * controls these specs click.
 */
const chromeLaunchOptions = {
  args: [
    "--disable-features=PasswordManager,AutofillServerCommunication,PasswordManagerOnboarding",
    "--disable-save-password-bubble",
    "--autofill-test-by-default=false",
  ],
};

// One worker: the specs share one local D1 file with the preview server.
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    // Override with E2E_BASEURL=https://<preview>.workers.dev to run the smoke
    // against a `wrangler versions upload` preview.
    baseURL: process.env.E2E_BASEURL ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    // The installed Chrome, so no browser download is needed.
    channel: "chrome",
    launchOptions: chromeLaunchOptions,
  },
  webServer: process.env.E2E_BASEURL
    ? undefined
    : {
        command: "vp preview --host 127.0.0.1 --port 4173 --strictPort",
        reuseExistingServer: process.env.E2E_REUSE === "1" && !process.env.CI,
        stderr: "pipe",
        stdout: "pipe",
        timeout: 120_000,
        url: "http://127.0.0.1:4173",
      },
});
