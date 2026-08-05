import { describe, expect, it } from "vitest";

import { guestTeamsProvider } from "@/features/teams/api/guest-teams";
import { resolveTeamsProvider } from "@/features/teams/api/resolve-teams-provider";
import { supabaseTeamsProvider } from "@/features/teams/api/supabase-teams";

describe("resolveTeamsProvider", () => {
    it("routes guest sessions through the local sandbox teams provider", () => {
        expect(resolveTeamsProvider(true)).toBe(guestTeamsProvider);
    });

    it("routes signed-in non-guest sessions through Supabase teams", () => {
        expect(resolveTeamsProvider(false)).toBe(supabaseTeamsProvider);
    });
});
