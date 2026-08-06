import { describe, expect, it } from "vitest";

import {
    DEMO_ACCOUNT_BADGE_I18N_KEY,
    demoAccountBadgeVisible,
} from "@/features/auth/lib/demo-account-badge";

describe("demo account badge (guardrails seam)", () => {
    it("is visible only for guest sessions", () => {
        expect(demoAccountBadgeVisible(true)).toBe(true);
        expect(demoAccountBadgeVisible(false)).toBe(false);
    });

    it("uses a stable i18n key for the Demo account chip", () => {
        expect(DEMO_ACCOUNT_BADGE_I18N_KEY).toBe("guest.demoAccount");
    });
});
