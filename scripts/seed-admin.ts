/**
 * Seed the first admin account against a running local dev/preview server.
 *
 * Usage:
 *   ADMIN_EMAIL=you@company.co.za ADMIN_PASSWORD=... nub run seed:admin
 *   # optional: BASEURL=http://127.0.0.1:4173 (default http://127.0.0.1:5173)
 *
 * Steps: sign up via better-auth's email API, then flip `role` to 'admin' in
 * the local D1 database. Re-login afterwards so the session carries the role.
 */
import { execFileSync } from "node:child_process";

const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || "Vektor Admin";
if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .dev.vars or env");
  process.exit(1);
}
const base = process.env.BASEURL ?? "http://127.0.0.1:5173";

const res = await fetch(`${base}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ email, password, name }),
}).catch(() => null);

if (!res || !res.ok) {
  console.error(
    `[seed-admin] signup failed (${res ? res.status : "server unreachable"}). ` +
      `Is the dev server running? nub run dev`,
  );
  if (res) console.error(await res.text().catch(() => ""));
  process.exit(1);
}
console.log(`[seed-admin] created user ${email}`);

execFileSync(
  "nubx",
  [
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--local",
    "--command",
    `UPDATE user SET role='admin' WHERE email='${email.replace(/'/g, "''")}'`,
  ],
  {
    stdio: "inherit",
  },
);
console.log(`[seed-admin] role set to 'admin'. Sign in at ${base}/login for an admin session.`);
