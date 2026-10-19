import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { createWebhookHandler, WEBHOOK_MAX_BODY_BYTES } from "./handler";

const secret = "test-webhook-secret";

function delivery(body: string, headers: Record<string, string> = {}): Request {
    return new Request("https://edge.test/github-webhook", {
        body,
        headers: {
            "X-GitHub-Delivery": "d-1",
            "X-GitHub-Event": "pull_request",
            ...headers,
        },
        method: "POST",
    });
}

function setup() {
    const createServiceClient = vi.fn(() => null);
    const handler = createWebhookHandler({
        cors: { allowedOrigins: [], allowHeaders: "content-type" },
        createServiceClient,
        webhookSecret: secret,
    });
    return { createServiceClient, handler };
}

function sign(payload: string, key = secret): string {
    return `sha256=${createHmac("sha256", key).update(payload).digest("hex")}`;
}

describe("github-webhook handler", () => {
    const body = JSON.stringify({ action: "closed", pull_request: {} });

    it("rejects a delivery without X-Hub-Signature-256 with 401", async () => {
        const { createServiceClient, handler } = setup();
        const response = await handler(delivery(body));

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: "invalid_signature" });
        expect(createServiceClient).not.toHaveBeenCalled();
    });

    it("rejects a delivery signed with the wrong secret with 401", async () => {
        const { createServiceClient, handler } = setup();
        const response = await handler(
            delivery(body, {
                "X-Hub-Signature-256": sign(body, "attacker-secret"),
            })
        );

        expect(response.status).toBe(401);
        expect(createServiceClient).not.toHaveBeenCalled();
    });

    it("rejects a body tampered after signing with 401", async () => {
        const { handler } = setup();
        const response = await handler(
            delivery(`${body} `, { "X-Hub-Signature-256": sign(body) })
        );

        expect(response.status).toBe(401);
    });

    it("returns 400 for a signed body that fails the schema", async () => {
        const { createServiceClient, handler } = setup();
        const invalid = JSON.stringify({
            action: "closed",
            pull_request: { number: "not-a-number" },
        });
        const response = await handler(
            delivery(invalid, { "X-Hub-Signature-256": sign(invalid) })
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "invalid_body" });
        expect(createServiceClient).not.toHaveBeenCalled();
    });

    it("returns 400 for signed non-JSON", async () => {
        const { handler } = setup();
        const response = await handler(
            delivery("not json", { "X-Hub-Signature-256": sign("not json") })
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "invalid_json" });
    });

    it("returns 413 when the body exceeds the size limit", async () => {
        const { handler } = setup();
        const huge = "x".repeat(WEBHOOK_MAX_BODY_BYTES + 1);
        const response = await handler(
            delivery(huge, { "X-Hub-Signature-256": sign(huge) })
        );

        expect(response.status).toBe(413);
    });

    it("accepts a correctly signed valid delivery", async () => {
        const { createServiceClient, handler } = setup();
        const response = await handler(
            delivery(body, { "X-Hub-Signature-256": sign(body) })
        );

        // Valid signature + schema → reaches the Supabase client factory
        // (null here → misconfigured, without leaking details).
        expect(createServiceClient).toHaveBeenCalledOnce();
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
            error: "server_misconfigured",
        });
    });

    it("skips signed non-PR events without parsing the body", async () => {
        const { handler } = setup();
        const response = await handler(
            delivery("{}", {
                "X-GitHub-Event": "ping",
                "X-Hub-Signature-256": sign("{}"),
            })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            reason: "ignored_event",
        });
    });

    it("sends no CORS allow-origin to a foreign Origin", async () => {
        const { handler } = setup();
        const response = await handler(
            delivery(body, { Origin: "https://evil.example" })
        );

        expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
});
