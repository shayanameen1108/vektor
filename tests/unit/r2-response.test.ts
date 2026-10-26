import { describe, expect, it } from "vite-plus/test";

import { r2Response } from "@/lib/r2-response";

/**
 * V02: every response from the private R2 download path must carry
 * `private, no-store` + `nosniff`, and `inline` must only be honored for the
 * proof-upload allowlist. The fixture is a preset external boundary — each
 * case declares what R2 would return for that request (full body, sliced
 * body, metadata-only, or missing) and the real helper is what turns those
 * preset outcomes into HTTP Responses. It does not evaluate Cloudflare's
 * conditional/range engine or the auth guards.
 */

interface Preset {
  /** Object body bytes; slice it yourself when the case is a ranged answer. */
  body?: string;
  /** Metadata-only object (what R2 returns when the body must not be sent). */
  metadataOnly?: boolean;
  size?: number;
  contentType?: string;
  cacheControl?: string;
  etag?: string;
  /** head/get both miss — the object does not exist. */
  missing?: boolean;
}

function r2(preset: Preset): R2Bucket {
  const meta = {
    httpEtag: preset.etag ?? "etag-doc",
    size: preset.size ?? preset.body?.length ?? 0,
    writeHttpMetadata(headers: Headers) {
      if (preset.contentType) headers.set("content-type", preset.contentType);
      if (preset.cacheControl) headers.set("cache-control", preset.cacheControl);
    },
  };
  const full = { ...meta, body: new TextEncoder().encode(preset.body ?? "") };
  return {
    async head() {
      return preset.missing ? null : { size: meta.size };
    },
    async get() {
      if (preset.missing) return null;
      return preset.metadataOnly ? { ...meta } : full;
    },
  } as unknown as R2Bucket;
}

const call = (
  preset: Preset,
  init?: { request?: Request; disposition?: "inline" | "attachment"; fallbackContentType?: string },
) =>
  r2Response({
    request: init?.request ?? new Request("https://test/download"),
    bucket: r2(preset),
    key: "doc",
    filename: "proof.pdf",
    disposition: init?.disposition ?? "attachment",
    ...(init?.fallbackContentType ? { fallbackContentType: init.fallbackContentType } : {}),
  });

const SECURITY = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
} as const;

// Non-416 presets all carry a public cache policy so every case proves the
// helper overrides stored metadata, not just absent metadata.
const PUBLIC = "public, max-age=31536000, immutable";

describe("r2Response", () => {
  it.each([
    {
      name: "unconditional 200 with full body, overriding a public cache policy",
      request: new Request("https://test/download"),
      preset: { body: "abcdefgh", cacheControl: PUBLIC },
      status: 200,
      body: "abcdefgh",
      length: "8",
      etag: "etag-doc",
      range: null,
    },
    {
      name: "206 partial body for a ranged answer",
      request: new Request("https://test/download", { headers: { range: "bytes=2-4" } }),
      preset: { body: "cde", size: 8, cacheControl: PUBLIC },
      status: 206,
      body: "cde",
      length: "3",
      etag: "etag-doc",
      range: "bytes 2-4/8",
    },
    {
      name: "304 metadata-only answer",
      request: new Request("https://test/download", { headers: { "if-none-match": "etag-doc" } }),
      preset: { metadataOnly: true, size: 8, cacheControl: PUBLIC },
      status: 304,
      body: "",
      length: null,
      etag: "etag-doc",
      range: null,
    },
    {
      name: "412 metadata-only answer on a failed precondition",
      request: new Request("https://test/download", {
        headers: { "if-match": "some-other-etag" },
      }),
      preset: { metadataOnly: true, size: 8, cacheControl: PUBLIC },
      status: 412,
      body: "",
      length: null,
      etag: "etag-doc",
      range: null,
    },
    {
      name: "416 unsatisfiable range",
      request: new Request("https://test/download", { headers: { range: "bytes=99-" } }),
      preset: { body: "abcdefgh", size: 8 },
      status: 416,
      body: "",
      length: null,
      etag: null,
      range: "bytes */8",
    },
  ])("serves $name privately", async ({ request, preset, status, body, length, etag, range }) => {
    const res = await call(preset, { request });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(status);
    expect(await res!.text()).toBe(body);
    // Absent expectations assert the header is genuinely missing (304/412/416).
    expect({
      "content-length": res!.headers.get("content-length"),
      etag: res!.headers.get("etag"),
      "content-range": res!.headers.get("content-range"),
    }).toEqual({ "content-length": length, etag, "content-range": range });
    expect(res!.headers.get("cache-control")).toBe(SECURITY["cache-control"]);
    expect(res!.headers.get("x-content-type-options")).toBe(SECURITY["x-content-type-options"]);
  });

  it("returns null for a missing object", async () => {
    expect(await call({ missing: true })).toBeNull();
  });

  it.each(["application/pdf", "IMAGE/PNG;charset=binary", "image/jpeg", "image/webp"])(
    "keeps trusted %s inline",
    async (contentType) => {
      const res = await call({ body: "x", contentType }, { disposition: "inline" });
      expect(res!.status).toBe(200);
      expect(res!.headers.get("content-disposition")).toContain("inline");
      expect(res!.headers.get("content-type")).toBe(contentType);
      expect(res!.headers.get("cache-control")).toBe(SECURITY["cache-control"]);
    },
  );

  it.each(["text/html", "image/svg+xml", "application/x-unknown"])(
    "downloads untrusted %s as octet-stream even when inline is asked",
    async (contentType) => {
      const res = await call({ body: "x", contentType }, { disposition: "inline" });
      expect(res!.status).toBe(200);
      expect(res!.headers.get("content-disposition")).toContain("attachment");
      expect(res!.headers.get("content-type")).toBe("application/octet-stream");
    },
  );

  it("lets real HTML metadata outvote a PDF fallback for inline", async () => {
    const res = await call(
      { body: "x", contentType: "text/html" },
      { disposition: "inline", fallbackContentType: "application/pdf" },
    );
    expect(res!.headers.get("content-disposition")).toContain("attachment");
    expect(res!.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("downloads as octet-stream when no type is known at all", async () => {
    const res = await call({ body: "x" }, { disposition: "inline" });
    expect(res!.headers.get("content-disposition")).toContain("attachment");
    expect(res!.headers.get("content-type")).toBe("application/octet-stream");
  });
});
