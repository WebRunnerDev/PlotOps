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
        const signOutLocal = vi.fn().mockResolvedValue(undefined);

        await expect(
            requireAuthSession({
                getUser: async () => ({ error: null, user: null }),
                isGuest: false,
                signOutLocal,
            })
        ).resolves.toBe("redirect-sign-in");

        expect(signOutLocal).toHaveBeenCalledOnce();
    });

    it("redirects and clears local Auth when getUser errors (dead JWT)", async () => {
        const signOutLocal = vi.fn().mockResolvedValue(undefined);

        await expect(
            requireAuthSession({
                getUser: async () => ({
                    error: new Error("JWT expired"),
                    user: null,
                }),
                isGuest: false,
                signOutLocal,
            })
        ).resolves.toBe("redirect-sign-in");

        expect(signOutLocal).toHaveBeenCalledOnce();
    });

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
