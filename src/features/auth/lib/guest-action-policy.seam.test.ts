import { describe, expect, it } from "vitest";

import { guestActionPolicy } from "@/features/auth/lib/guest-action-policy";

describe("guestActionPolicy (guardrails seam)", () => {
    it("blocks delete Team/Project and invite creation for guests", () => {
        expect(guestActionPolicy(true)).toEqual({
            canCreateInvite: false,
            canDeleteProject: false,
            canDeleteTeam: false,
        });
    });

    it("does not block destructive actions for normal sessions", () => {
        expect(guestActionPolicy(false)).toEqual({
            canCreateInvite: true,
            canDeleteProject: true,
            canDeleteTeam: true,
        });
    });
});
