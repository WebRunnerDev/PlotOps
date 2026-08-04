import { describe, expect, it } from "vitest";

import {
    GUEST_DEMO_EMAIL,
    GUEST_DEMO_USER_ID,
    isGuestSession,
} from "@/features/auth/lib/is-guest-session";

describe("isGuestSession", () => {
    it("returns true when the user id is the seeded demo guest", () => {
        expect(
            isGuestSession({
                email: "someone@example.com",
                id: GUEST_DEMO_USER_ID,
            })
        ).toBe(true);
    });

    it("returns true when the email matches the demo guest (case-insensitive)", () => {
        expect(
            isGuestSession({
                email: GUEST_DEMO_EMAIL.toUpperCase(),
                id: "11111111-1111-4111-8111-111111111111",
            })
        ).toBe(true);
    });

    it("returns false for a normal signed-in user", () => {
        expect(
            isGuestSession({
                email: "alice@example.com",
                id: "11111111-1111-4111-8111-111111111111",
            })
        ).toBe(false);
    });

    it("returns false when there is no user", () => {
        expect(isGuestSession(null)).toBe(false);
        expect(isGuestSession()).toBe(false);
    });
});
