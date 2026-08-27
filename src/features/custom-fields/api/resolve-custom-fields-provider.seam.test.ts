import { describe, expect, it } from "vitest";

import { guestCustomFieldsProvider } from "@/features/custom-fields/api/guest-custom-fields";
import { resolveCustomFieldsProvider } from "@/features/custom-fields/api/resolve-custom-fields-provider";
import { supabaseCustomFieldsProvider } from "@/features/custom-fields/api/supabase-custom-fields";

describe("resolveCustomFieldsProvider", () => {
    it("returns guest adapter when Guest", () => {
        expect(resolveCustomFieldsProvider(true)).toBe(
            guestCustomFieldsProvider
        );
    });

    it("returns supabase adapter when signed in", () => {
        expect(resolveCustomFieldsProvider(false)).toBe(
            supabaseCustomFieldsProvider
        );
    });
});
