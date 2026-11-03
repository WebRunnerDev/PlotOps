import { describe, expect, it } from "vitest";

import type { UserSupabase } from "./supabase.ts";

import { verifyAccessToken } from "./auth.ts";

const environment = {
    SUPABASE_PUBLISHABLE_KEY: "key",
    SUPABASE_URL: "https://ijcelrdcygzyzhcijkhe.supabase.co",
};

const ISSUER = "https://ijcelrdcygzyzhcijkhe.supabase.co/auth/v1";

function clientReturning(
    result: Awaited<ReturnType<UserSupabase["auth"]["getClaims"]>>
): UserSupabase {
    return {
        auth: { getClaims: async () => result },
    } as unknown as UserSupabase;
}

describe("verifyAccessToken", () => {
    it("returns the user from verified claims", async () => {
        const supabase = clientReturning({
            data: {
                claims: {
                    email: "a@example.dev",
                    iss: ISSUER,
                    role: "authenticated",
                    sub: "user-1",
                },
            },
            error: null,
        });
        await expect(
            verifyAccessToken(supabase, "jwt", environment)
        ).resolves.toEqual({ email: "a@example.dev", id: "user-1" });
    });

    it("rejects a failed verification", async () => {
        const supabase = clientReturning({
            data: null,
            error: { message: "invalid signature" },
        });
        await expect(
            verifyAccessToken(supabase, "jwt", environment)
        ).resolves.toBeNull();
    });

    it("rejects a token from another issuer", async () => {
        const supabase = clientReturning({
            data: {
                claims: {
                    iss: "https://other.supabase.co/auth/v1",
                    role: "authenticated",
                    sub: "user-1",
                },
            },
            error: null,
        });
        await expect(
            verifyAccessToken(supabase, "jwt", environment)
        ).resolves.toBeNull();
    });

    it("rejects non-user roles (anon key JWT)", async () => {
        const supabase = clientReturning({
            data: { claims: { iss: ISSUER, role: "anon", sub: "" } },
            error: null,
        });
        await expect(
            verifyAccessToken(supabase, "jwt", environment)
        ).resolves.toBeNull();
    });

    it("treats a thrown verifier as unauthenticated", async () => {
        const supabase = {
            auth: {
                getClaims: async () => {
                    throw new Error("jwks fetch failed");
                },
            },
        } as unknown as UserSupabase;
        await expect(
            verifyAccessToken(supabase, "jwt", environment)
        ).resolves.toBeNull();
    });
});
