/**
 * Verify GitHub webhook HMAC (`X-Hub-Signature-256`).
 * Pure Web Crypto — runnable in Deno Edge Functions and Node (Vitest).
 */
export async function verifyGitHubSignature(
    payload: string,
    signatureHeader: null | string,
    secret: string
): Promise<boolean> {
    if (!secret || !signatureHeader?.startsWith("sha256=")) {
        return false;
    }

    const expectedHex = signatureHeader.slice("sha256=".length).toLowerCase();
    if (!/^[0-9a-f]+$/.test(expectedHex)) {
        return false;
    }

    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { hash: "SHA-256", name: "HMAC" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(payload)
    );

    const computedHex = [...new Uint8Array(signature)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

    return timingSafeEqualHex(computedHex, expectedHex);
}

function timingSafeEqualHex(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let mismatch = 0;
    for (let index = 0; index < a.length; index += 1) {
        mismatch |= (a.codePointAt(index) ?? 0) ^ (b.codePointAt(index) ?? 0);
    }

    return mismatch === 0;
}
