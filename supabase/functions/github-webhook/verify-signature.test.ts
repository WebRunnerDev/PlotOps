import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyGitHubSignature } from "./verify-signature";

function sign(payload: string, secret: string): string {
    const digest = createHmac("sha256", secret).update(payload).digest("hex");
    return `sha256=${digest}`;
}

describe("verifyGitHubSignature", () => {
    const secret = "test-webhook-secret";
    const payload = '{"action":"closed","number":1}';

    it("accepts a valid X-Hub-Signature-256", async () => {
        const ok = await verifyGitHubSignature(
            payload,
            sign(payload, secret),
            secret
        );
        expect(ok).toBe(true);
    });

    it("rejects a wrong signature", async () => {
        const ok = await verifyGitHubSignature(
            payload,
            "sha256=deadbeef",
            secret
        );
        expect(ok).toBe(false);
    });

    it("rejects a missing or malformed header", async () => {
        expect(await verifyGitHubSignature(payload, null, secret)).toBe(false);
        expect(await verifyGitHubSignature(payload, "sha1=abc", secret)).toBe(
            false
        );
        expect(
            await verifyGitHubSignature(payload, sign(payload, secret), "")
        ).toBe(false);
    });
});
