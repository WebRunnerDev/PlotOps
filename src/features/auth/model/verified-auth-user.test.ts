import type { Session, User } from "@supabase/supabase-js";

import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const getUser = vi.fn();

vi.mock("@/shared/api/supabase", () => ({
    supabase: {
        auth: {
            getSession: (...arguments_: unknown[]) => getSession(...arguments_),
            getUser: (...arguments_: unknown[]) => getUser(...arguments_),
        },
    },
}));

import {
    getVerifiedAuthUser,
    resetVerifiedAuthUser,
} from "@/features/auth/model/verified-auth-user";

function sessionWith(accessToken: string, user: Partial<User> = {}): Session {
    return {
        access_token: accessToken,
        user: { id: "user-1", ...user } as User,
    } as Session;
}

function stored(session: null | Session) {
    getSession.mockResolvedValue({ data: { session }, error: null });
}

describe("getVerifiedAuthUser", () => {
    beforeEach(() => {
        getSession.mockReset();
        getUser.mockReset();
        resetVerifiedAuthUser();
    });

    it("calls the Auth API once per access token", async () => {
        stored(sessionWith("token-a"));
        getUser.mockResolvedValue({
            data: { user: { id: "user-1" } },
            error: null,
        });

        await getVerifiedAuthUser();
        await getVerifiedAuthUser();
        await getVerifiedAuthUser();

        expect(getUser).toHaveBeenCalledOnce();
        expect(getUser).toHaveBeenCalledWith("token-a");
    });

    it("re-verifies after the token rotates", async () => {
        getUser.mockResolvedValue({
            data: { user: { id: "user-1" } },
            error: null,
        });

        stored(sessionWith("token-a"));
        await getVerifiedAuthUser();
        stored(sessionWith("token-b"));
        await getVerifiedAuthUser();

        expect(getUser).toHaveBeenCalledTimes(2);
        expect(getUser).toHaveBeenLastCalledWith("token-b");
    });

    it("returns the stored user on a cache hit so USER_UPDATED metadata is current", async () => {
        getUser.mockResolvedValue({
            data: { user: { id: "user-1" } },
            error: null,
        });
        stored(sessionWith("token-a"));
        await getVerifiedAuthUser();

        stored(
            sessionWith("token-a", {
                user_metadata: { first_name: "Renamed" },
            })
        );
        const { user } = await getVerifiedAuthUser();

        expect(user?.user_metadata).toEqual({ first_name: "Renamed" });
    });

    it("does not cache a failed check", async () => {
        stored(sessionWith("token-a"));
        getUser.mockResolvedValueOnce({
            data: { user: null },
            error: new AuthRetryableFetchError("Failed to fetch", 0),
        });
        getUser.mockResolvedValueOnce({
            data: { user: { id: "user-1" } },
            error: null,
        });

        const first = await getVerifiedAuthUser();
        const second = await getVerifiedAuthUser();

        expect(first.user).toBeNull();
        expect(first.error).toBeInstanceOf(AuthRetryableFetchError);
        expect(second.user?.id).toBe("user-1");
        expect(getUser).toHaveBeenCalledTimes(2);
    });

    it("passes through a getSession refresh error without calling /user", async () => {
        const error = new AuthRetryableFetchError("Failed to fetch", 0);
        getSession.mockResolvedValue({ data: { session: null }, error });

        await expect(getVerifiedAuthUser()).resolves.toEqual({
            error,
            user: null,
        });
        expect(getUser).not.toHaveBeenCalled();
    });

    it("reports no user when nothing is stored", async () => {
        stored(null);

        await expect(getVerifiedAuthUser()).resolves.toEqual({
            error: null,
            user: null,
        });
        expect(getUser).not.toHaveBeenCalled();
    });
});
