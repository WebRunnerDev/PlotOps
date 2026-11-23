import {
    AuthApiError,
    AuthRefreshDiscardedError,
    AuthRetryableFetchError,
} from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { requireAuthSession } from "./require-auth-session";

describe("requireAuthSession", () => {
    it("allows Guest Session without calling Auth", async () => {
        const getUser = vi.fn();
        const signOutLocal = vi.fn();

        await expect(
            requireAuthSession({
                getUser,
                isGuest: true,
                signOutLocal,
            })
        ).resolves.toBe("ok");

        expect(getUser).not.toHaveBeenCalled();
        expect(signOutLocal).not.toHaveBeenCalled();
    });

    it("redirects and clears local Auth when getUser has no user", async () => {
        const signOutLocal = vi.fn(async () => {});

        await expect(
            requireAuthSession({
                getUser: async () => ({ error: null, user: null }),
                isGuest: false,
                signOutLocal,
            })
        ).resolves.toBe("redirect-sign-in");

        expect(signOutLocal).toHaveBeenCalledOnce();
    });

    it("redirects and clears local Auth when the server dropped the user", async () => {
        const signOutLocal = vi.fn(async () => {});

        await expect(
            requireAuthSession({
                getUser: async () => ({
                    error: new AuthApiError(
                        "User from sub claim does not exist",
                        403,
                        "user_not_found"
                    ),
                    user: null,
                }),
                isGuest: false,
                signOutLocal,
            })
        ).resolves.toBe("redirect-sign-in");

        expect(signOutLocal).toHaveBeenCalledOnce();
    });

    it.each([
        ["offline", new AuthRetryableFetchError("Failed to fetch", 0)],
        ["another tab won the refresh", new AuthRefreshDiscardedError()],
        [
            "rate limited",
            new AuthApiError(
                "Too many requests",
                429,
                "over_request_rate_limit"
            ),
        ],
    ])(
        "keeps the session on a transient error (%s) — local sign-out logs out every tab",
        async (_label, error) => {
            const signOutLocal = vi.fn(async () => {});

            await expect(
                requireAuthSession({
                    getUser: async () => ({ error, user: null }),
                    isGuest: false,
                    signOutLocal,
                })
            ).resolves.toBe("ok");

            expect(signOutLocal).not.toHaveBeenCalled();
        }
    );

    it("allows a live Auth user", async () => {
        const signOutLocal = vi.fn();

        await expect(
            requireAuthSession({
                getUser: async () => ({
                    error: null,
                    user: { id: "u1" },
                }),
                isGuest: false,
                signOutLocal,
            })
        ).resolves.toBe("ok");

        expect(signOutLocal).not.toHaveBeenCalled();
    });
});
