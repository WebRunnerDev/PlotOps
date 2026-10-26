import type { z } from "zod";

export type BodyError = {
    error: "invalid_body" | "invalid_json" | "payload_too_large";
    ok: false;
    status: 400 | 413;
};

export type ParsedBody<T> = BodyError | { data: T; ok: true };

export function jsonResponse(
    body: unknown,
    status: number,
    headers: Record<string, string>
): Response {
    return Response.json(body, {
        headers: { ...headers, "Content-Type": "application/json" },
        status,
    });
}

/** Parse + validate a JSON body; zod issue details never leave the function. */
export function parseJsonBody<T>(
    text: string,
    schema: z.ZodType<T>
): ParsedBody<T> {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return { error: "invalid_json", ok: false, status: 400 };
    }
    const result = schema.safeParse(raw);
    if (!result.success) {
        return { error: "invalid_body", ok: false, status: 400 };
    }
    return { data: result.data, ok: true };
}

/**
 * Read the raw body as text, refusing more than `maxBytes` — checks
 * `Content-Length` up front and counts streamed bytes (chunked uploads).
 */
export async function readBodyText(
    request: Request,
    maxBytes: number
): Promise<BodyError | { ok: true; text: string }> {
    const tooLarge: BodyError = {
        error: "payload_too_large",
        ok: false,
        status: 413,
    };

    const declared = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(declared) && declared > maxBytes) return tooLarge;
    if (!request.body) return { ok: true, text: "" };

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            return tooLarge;
        }
        chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return { ok: true, text: new TextDecoder().decode(bytes) };
}

/**
 * Last-resort boundary: an unexpected throw becomes a generic 500 — no stack
 * or internal message in the response; only the message goes to the log.
 */
export function withErrorBoundary(
    handler: (request: Request) => Promise<Response>,
    headersFor: (request: Request) => Record<string, string> = () => ({})
): (request: Request) => Promise<Response> {
    return async (request) => {
        try {
            return await handler(request);
        } catch (error) {
            console.error(
                JSON.stringify({
                    error: error instanceof Error ? error.message : "unknown",
                    reason: "unhandled_error",
                })
            );
            return jsonResponse(
                { error: "internal_error" },
                500,
                headersFor(request)
            );
        }
    };
}
