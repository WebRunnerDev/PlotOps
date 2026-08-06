import { describe, expect, it } from "vitest";

import { guestTasksProvider } from "@/features/tasks/api/guest-tasks";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import { supabaseTasksProvider } from "@/features/tasks/api/supabase-tasks";

describe("resolveTasksProvider", () => {
    it("routes guest sessions through the local sandbox tasks provider", () => {
        expect(resolveTasksProvider(true)).toBe(guestTasksProvider);
    });

    it("routes signed-in non-guest sessions through Supabase tasks", () => {
        expect(resolveTasksProvider(false)).toBe(supabaseTasksProvider);
    });
});
