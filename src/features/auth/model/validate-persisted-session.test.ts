import type { Session, User } from "@supabase/supabase-js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const signOut = vi.fn();
const clearToken = vi.fn();

vi.mock("@/shared/api/supabase", () => ({
    supabase: {
        auth: {
            getUser: (...arguments_: unknown[]) => getUser(...arguments_),
            signOut: (...arguments_: unknown[]) => signOut(...arguments_),
        },
    },
}));

vi.mock("@/features/auth/model/github-token", () => ({
    clearGitHubAccessToken: (...arguments_: unknown[]) =>
        clearToken(...arguments_),
}));

import { validatePersistedSession } from "@/features/auth/model/validate-persisted-session";

function sessionFixture(): Session {
    const user = { email: "demo@plotops.app", id: "user-1" } as User;
    return {
        access_token: "access",
        expires_in: 3600,
        refresh_token: "refresh",
        token_type: "bearer",
        user,
    } as Session;
}

describe("validatePersistedSession", () => {
    beforeEach(() => {
        getUser.mockReset();
        signOut.mockReset();
        clearToken.mockReset();
        signOut.mockResolvedValue({ error: null });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("signs out locally when the Auth API rejects a persisted session", async () => {
        getUser.mockResolvedValue({
            data: { user: null },
            error: { message: "invalid claim" },
        });

        const result = await validatePersistedSession(sessionFixture());

        expect(result).toBeNull();
        expect(signOut).toHaveBeenCalledWith({ scope: "local" });
        expect(clearToken).toHaveBeenCalledTimes(1);
    });

    it("does not clear a remounted boot's session when a stale validation aborts", async () => {
        // Strict Mode / remount: abandoned getUser fails after cleanup aborted
        // the first boot. Signing out here would strip the JWT while React
        // still has auth.user from the second boot → RLS "no access" flashes.
        let resolveGetUser!: (value: unknown) => void;
        getUser.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveGetUser = resolve;
                })
        );

        const controller = new AbortController();
        const pending = validatePersistedSession(sessionFixture(), {
            signal: controller.signal,
        });

        controller.abort();
        resolveGetUser({
            data: { user: null },
            error: { message: "Auth session missing" },
        });

        await expect(pending).resolves.toBeNull();
        expect(signOut).not.toHaveBeenCalled();
        expect(clearToken).not.toHaveBeenCalled();
    });

    it("returns the session when getUser succeeds and the boot is still current", async () => {
        const session = sessionFixture();
        const freshUser = { email: "demo@plotops.app", id: "user-1" } as User;
        getUser.mockResolvedValue({
            data: { user: freshUser },
            error: null,
        });

        const result = await validatePersistedSession(session, {
            signal: new AbortController().signal,
        });

        expect(result).toEqual({ ...session, user: freshUser });
        expect(signOut).not.toHaveBeenCalled();
    });
});
