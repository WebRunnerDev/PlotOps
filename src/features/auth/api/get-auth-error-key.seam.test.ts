import type { AuthError } from "@supabase/supabase-js";

import { describe, expect, it } from "vitest";

import { getAuthErrorKey } from "@/features/auth/api/auth-api";

function authError(
    partial: Partial<AuthError> & { message: string }
): AuthError {
    return partial as AuthError;
}

describe("getAuthErrorKey", () => {
    it("maps known AuthError.code values before message matching", () => {
        expect(
            getAuthErrorKey(
                authError({
                    code: "invalid_credentials",
                    message: "something about password",
                })
            )
        ).toBe("errors.invalidCredentials");

        expect(
            getAuthErrorKey(
                authError({
                    code: "email_not_confirmed",
                    message: "unrelated",
                })
            )
        ).toBe("errors.emailNotConfirmed");

        expect(
            getAuthErrorKey(
                authError({
                    code: "user_already_exists",
                    message: "unrelated",
                })
            )
        ).toBe("errors.userAlreadyRegistered");

        expect(
            getAuthErrorKey(
                authError({
                    code: "weak_password",
                    message: "Password is too weak",
                })
            )
        ).toBe("errors.weakPassword");
    });

    it("falls back to message matching when code is missing", () => {
        expect(
            getAuthErrorKey(authError({ message: "Invalid login credentials" }))
        ).toBe("errors.invalidCredentials");
    });

    it("maps known HTTP status before message matching when code is missing", () => {
        expect(
            getAuthErrorKey(
                authError({
                    message: "Password is known to be weak",
                    status: 429,
                })
            )
        ).toBe("errors.rateLimited");
    });

    it("maps over_request_rate_limit before unrelated message text", () => {
        expect(
            getAuthErrorKey(
                authError({
                    code: "over_request_rate_limit",
                    message: "Password reset rate limit exceeded",
                })
            )
        ).toBe("errors.rateLimited");
    });

    it("returns generic for unknown codes", () => {
        expect(
            getAuthErrorKey(
                authError({
                    code: "signup_disabled",
                    message: "Signups not allowed",
                })
            )
        ).toBe("errors.generic");
    });
});
