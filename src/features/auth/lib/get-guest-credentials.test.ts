import { describe, expect, it } from "vitest";

import { GUEST_DEMO_EMAIL } from "@/features/auth/lib/is-guest-session";

import { getGuestCredentials } from "./get-guest-credentials";

describe("getGuestCredentials", () => {
    it("returns well-known local demo credentials when env is unset", () => {
        expect(getGuestCredentials({})).toEqual({
            email: GUEST_DEMO_EMAIL,
            password: "plotops-demo-local",
        });
    });

    it("prefers VITE_GUEST_EMAIL and VITE_GUEST_PASSWORD when set", () => {
        expect(
            getGuestCredentials({
                VITE_GUEST_EMAIL: " remote-demo@plotops.app ",
                VITE_GUEST_PASSWORD: "remote-strong-password",
            })
        ).toEqual({
            email: "remote-demo@plotops.app",
            password: "remote-strong-password",
        });
    });

    it("falls back to local defaults when env values are blank", () => {
        expect(
            getGuestCredentials({
                VITE_GUEST_EMAIL: "   ",
                VITE_GUEST_PASSWORD: "",
            })
        ).toEqual({
            email: GUEST_DEMO_EMAIL,
            password: "plotops-demo-local",
        });
    });
});
