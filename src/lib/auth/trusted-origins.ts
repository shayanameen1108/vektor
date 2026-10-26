/**
 * Better Auth rejects requests whose `Origin` header is not in
 * `trustedOrigins`. The app is served from both the apex and `www`
 * hostnames (see `routes` in `wrangler.jsonc`), so trusting only the
 * configured `BETTER_AUTH_URL` breaks login on the other hostname with
 * "invalid origin". These helpers expand each configured URL with its
 * apex/www counterpart so both work.
 */
export function expandWithWwwVariants(rawUrl: string | undefined | null): string[] {
  if (!rawUrl) return [];
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];
  const normalized = trimmed.replace(/\/$/, "");
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return [normalized];
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return [normalized];
  const hostname = parsed.hostname.toLowerCase();
  const isLocalOrIp =
    hostname === "localhost" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(":") ||
    !hostname.includes(".");
  if (isLocalOrIp) return [parsed.origin];
  const counterpart = new URL(parsed.origin);
  if (hostname.startsWith("www.")) {
    counterpart.hostname = hostname.slice(4);
  } else {
    counterpart.hostname = `www.${hostname}`;
  }
  return [...new Set([parsed.origin, counterpart.origin])];
}

/** All origins Better Auth should accept requests from. */
export function buildTrustedOrigins(...configuredUrls: (string | undefined | null)[]): string[] {
  const expanded = configuredUrls.flatMap((url) => expandWithWwwVariants(url));
  return [
    ...new Set([
      ...expanded,
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:4173",
      "http://localhost:4173",
    ]),
  ];
}
