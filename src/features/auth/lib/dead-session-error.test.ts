import {
    AuthApiError,
    AuthRefreshDiscardedError,
    AuthRetryableFetchError,
    AuthSessionMissingError,
} from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { isDeadSessionError } from "./dead-session-error";

describe("isDeadSessionError", () => {
    it.each([
        ["session missing", new AuthSessionMissingError()],
        [
            "user deleted (db reset)",
            new AuthApiError(
                "User from sub claim does not exist",
                403,
                "user_not_found"
            ),
        ],
        [
            "refresh token revoked",
            new AuthApiError(
                "Invalid Refresh Token",
                400,
                "refresh_token_not_found"
            ),
        ],
        [
            "refresh token reuse detected",
            new AuthApiError("Already Used", 400, "refresh_token_already_used"),
        ],
        [
            "session time-boxed",
            new AuthApiError("Session expired", 403, "session_expired"),
        ],
    ])("treats %s as dead", (_label, error) => {
        expect(isDeadSessionError(error)).toBe(true);
    });

    it.each([
        [
            "offline after sleep",
            new AuthRetryableFetchError("Failed to fetch", 0),
        ],
        ["Auth 5xx", new AuthRetryableFetchError("Bad gateway", 502)],
        ["another tab won the refresh", new AuthRefreshDiscardedError()],
        [
            "rate limited",
            new AuthApiError(
                "Too many requests",
                429,
                "over_request_rate_limit"
            ),
        ],
        [
            "clock-skewed JWT",
            new AuthApiError("token is expired", 403, "bad_jwt"),
        ],
        ["plain Error", new Error("JWT expired")],
        ["null", null],
    ])("treats %s as transient", (_label, error) => {
        expect(isDeadSessionError(error)).toBe(false);
    });
});
