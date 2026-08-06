import { describe, expect, it } from "vitest";

import { isProfileGateRequired } from "@/features/auth/lib/guest-profile-gate";

describe("guest profile gate (guardrails seam)", () => {
    it("does not require the complete-profile gate for guests", () => {
        expect(
            isProfileGateRequired({
                isGuest: true,
                profileNamesComplete: false,
            })
        ).toBe(false);
    });

    it("requires the gate for incomplete non-guest profiles", () => {
        expect(
            isProfileGateRequired({
                isGuest: false,
                profileNamesComplete: false,
            })
        ).toBe(true);
    });

    it("skips the gate when non-guest names are already complete", () => {
        expect(
            isProfileGateRequired({
                isGuest: false,
                profileNamesComplete: true,
            })
        ).toBe(false);
    });
});
