import { describe, expect, it } from "vitest";

import { capabilitiesForRole } from "@/features/projects/model/access";
import { resolveTeamAccess } from "@/features/teams/model/use-team-access";

describe("resolveTeamAccess — refetch failures", () => {
    it("keeps cached membership caps when a membership refetch fails", () => {
        const access = resolveTeamAccess({
            membership: { role: "contributor" },
            membershipError: true,
            membershipLoading: false,
            team: { owner_id: "owner-1" },
            teamError: false,
            teamLoading: false,
            userId: "member-1",
        });

        expect(access).toEqual({
            ...capabilitiesForRole("contributor"),
            isError: false,
            isLoading: false,
            isSettled: true,
        });
    });

    it("reports error when membership fails with no cached row", () => {
        const access = resolveTeamAccess({
            membership: null,
            membershipError: true,
            membershipLoading: false,
            team: { owner_id: "owner-1" },
            teamError: false,
            teamLoading: false,
            userId: "member-1",
        });

        expect(access.isError).toBe(true);
        expect(access.canView).toBe(false);
        expect(access.isSettled).toBe(true);
    });
});
