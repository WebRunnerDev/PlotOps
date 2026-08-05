import { describe, expect, it } from "vitest";

import { mergeCompleteProfilePrefill } from "@/features/auth/lib/complete-profile-prefill";

describe("mergeCompleteProfilePrefill", () => {
    it("fills empty fields when profile names arrive after mount", () => {
        expect(
            mergeCompleteProfilePrefill(
                { firstName: "", lastName: "" },
                { firstName: "Ada", lastName: "Lovelace" }
            )
        ).toEqual({ firstName: "Ada", lastName: "Lovelace" });
    });

    it("does not overwrite in-progress typing", () => {
        expect(
            mergeCompleteProfilePrefill(
                { firstName: "Ada", lastName: "" },
                { firstName: "Grace", lastName: "Hopper" }
            )
        ).toEqual({ firstName: "Ada", lastName: "Hopper" });
    });
});
