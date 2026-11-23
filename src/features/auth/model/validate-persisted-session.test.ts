import {
    AuthApiError,
    AuthRefreshDiscardedError,
    AuthRetryableFetchError,
    type Session,
    type User,
} from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const signOut = vi.fn();
const clearToken = vi.fn();

vi.mock("@/shared/api/supabase", () => ({
    supabase: {
        auth: {
            signOut: (...arguments_: unknown[]) => signOut(...arguments_),
        },
    },
}));

vi.mock("@/features/auth/model/verified-auth-user", () => ({
    getVerifiedAuthUser: (...arguments_: unknown[]) => getUser(...arguments_),
    resetVerifiedAuthUser: vi.fn(),
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
            error: new AuthApiError(
                "User from sub claim does not exist",
                403,
                "user_not_found"
            ),
            user: null,
        });

        const result = await validatePersistedSession(sessionFixture());

        expect(result).toBeNull();
        expect(signOut).toHaveBeenCalledWith({ scope: "local" });
        expect(clearToken).toHaveBeenCalledTimes(1);
    });

    it.each([
        [
            "offline after sleep",
            new AuthRetryableFetchError("Failed to fetch", 0),
        ],
        ["another tab won the refresh", new AuthRefreshDiscardedError()],
    ])(
        "keeps the stored session on a transient error (%s)",
        async (_label, error) => {
            const session = sessionFixture();
            getUser.mockResolvedValue({ error, user: null });

            const result = await validatePersistedSession(session);

            expect(result).toBe(session);
            expect(signOut).not.toHaveBeenCalled();
            expect(clearToken).not.toHaveBeenCalled();
        }
    );

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
            error: new AuthApiError("User not found", 403, "user_not_found"),
            user: null,
        });

        await expect(pending).resolves.toBeNull();
        expect(signOut).not.toHaveBeenCalled();
        expect(clearToken).not.toHaveBeenCalled();
    });

    it("returns the session when getUser succeeds and the boot is still current", async () => {
        const session = sessionFixture();
        const freshUser = { email: "demo@plotops.app", id: "user-1" } as User;
        getUser.mockResolvedValue({ error: null, user: freshUser });

        const result = await validatePersistedSession(session, {
            signal: new AbortController().signal,
        });

        expect(result).toEqual({ ...session, user: freshUser });
        expect(signOut).not.toHaveBeenCalled();
    });
});
