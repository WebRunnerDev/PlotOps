import { describe, expect, it } from "vitest";

import { guestLabelsProvider } from "@/features/labels/api/guest-labels";
import { resolveLabelsProvider } from "@/features/labels/api/resolve-labels-provider";
import { supabaseLabelsProvider } from "@/features/labels/api/supabase-labels";

describe("resolveLabelsProvider", () => {
    it("routes guest sessions through the local sandbox labels provider", () => {
        expect(resolveLabelsProvider(true)).toBe(guestLabelsProvider);
    });

    it("routes signed-in non-guest sessions through Supabase labels", () => {
        expect(resolveLabelsProvider(false)).toBe(supabaseLabelsProvider);
    });
});
