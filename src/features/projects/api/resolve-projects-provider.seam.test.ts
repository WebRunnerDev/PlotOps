import { describe, expect, it } from "vitest";

import { guestProjectsProvider } from "@/features/projects/api/guest-projects";
import { resolveProjectsProvider } from "@/features/projects/api/resolve-projects-provider";
import { supabaseProjectsProvider } from "@/features/projects/api/supabase-projects";

describe("resolveProjectsProvider", () => {
    it("routes guest sessions through the local sandbox projects provider", () => {
        expect(resolveProjectsProvider(true)).toBe(guestProjectsProvider);
    });

    it("routes signed-in non-guest sessions through Supabase projects", () => {
        expect(resolveProjectsProvider(false)).toBe(supabaseProjectsProvider);
    });
});
