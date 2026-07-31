import { describe, expect, it } from "vitest";

import { createAsyncGenerationGate } from "@/features/auth/model/async-generation-gate";

describe("async generation gate", () => {
    it("marks an older load stale after a newer load begins", async () => {
        const gate = createAsyncGenerationGate();
        const applied: Array<null | string> = [];

        const older = gate.begin();
        const olderFetch = Promise.resolve("profile-a");

        const newer = gate.begin();
        applied.push(null); // sign-out / clear

        const olderProfile = await olderFetch;
        if (gate.isCurrent(older)) {
            applied.push(olderProfile);
        }

        expect(gate.isCurrent(newer)).toBe(true);
        expect(gate.isCurrent(older)).toBe(false);
        expect(applied).toEqual([null]);
    });

    it("applies the latest load when it finishes last", async () => {
        const gate = createAsyncGenerationGate();
        let profile: null | string = "stale";

        const first = gate.begin();
        const second = gate.begin();

        const secondProfile = await Promise.resolve("profile-b");
        if (gate.isCurrent(second)) {
            profile = secondProfile;
        }

        const firstProfile = await Promise.resolve("profile-a");
        if (gate.isCurrent(first)) {
            profile = firstProfile;
        }

        expect(profile).toBe("profile-b");
    });
});
