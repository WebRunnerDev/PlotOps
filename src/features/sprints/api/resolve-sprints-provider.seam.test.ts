import { describe, expect, it } from "vitest";

import { guestSprintsProvider } from "@/features/sprints/api/guest-sprints-provider";
import { resolveSprintsProvider } from "@/features/sprints/api/resolve-sprints-provider";
import { supabaseSprintsProvider } from "@/features/sprints/api/supabase-sprints-provider";

describe("resolveSprintsProvider", () => {
    it("routes Guest Sessions through the local sandbox Sprint provider", () => {
        expect(resolveSprintsProvider(true)).toBe(guestSprintsProvider);
    });

    it("routes non-Guest sessions through the Supabase Sprint provider", () => {
        expect(resolveSprintsProvider(false)).toBe(supabaseSprintsProvider);
    });
});
