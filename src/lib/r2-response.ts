export interface R2ResponseOptions {
  request: Request;
  bucket: R2Bucket;
  key: string;
  filename: string;
  disposition: "attachment" | "inline";
  fallbackContentType?: string;
}

/** Build a private R2 download response after the caller has authorized access. */
export async function r2Response(options: R2ResponseOptions): Promise<Response | null> {
  const { request, bucket, key } = options;
  const head = await bucket.head(key);
  if (!head) return null;

  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, head.size) : null;
  if (rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: { "content-range": `bytes */${head.size}`, "accept-ranges": "bytes" },
    });
  }

  const object = await bucket.get(key, {
    onlyIf: request.headers,
    ...(range ? { range: { offset: range.start, length: range.length } } : {}),
  });
  if (!object) return null;

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set(
    "content-disposition",
    `${options.disposition}; filename="${safeFilename(options.filename)}"`,
  );
  if (!headers.has("content-type")) {
    headers.set("content-type", options.fallbackContentType ?? "application/octet-stream");
  }

  if (!("body" in object)) {
    const preconditionFailed =
      request.headers.has("if-match") || request.headers.has("if-unmodified-since");
    return new Response(null, { status: preconditionFailed ? 412 : 304, headers });
  }

  if (range) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${head.size}`);
    headers.set("content-length", String(range.length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}

function parseRange(
  value: string,
  size: number,
): { start: number; end: number; length: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || size <= 0) return null;
  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (!startText && !endText) return null;

  let start: number;
  let end: number;
  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
      return null;
    }
    if (start >= size) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end, length: end - start + 1 };
}

function safeFilename(value: string): string {
  const cleaned = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || '"\\/'.includes(character) ? "_" : character;
  })
    .join("")
    .trim();
  return cleaned.slice(0, 180) || "download";
}

/** Best-effort R2 cleanup — failed deletes are logged, never surfaced to the request. */
export async function deleteQuietly(bucket: R2Bucket, key: string, what = "object"): Promise<void> {
  try {
    await bucket.delete(key);
  } catch (error) {
    console.warn(`Failed to clean up R2 ${what}`, key, error);
  }
}
