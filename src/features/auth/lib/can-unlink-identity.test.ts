import { describe, expect, it } from "vitest";

import { canUnlinkIdentity } from "@/features/auth/lib/can-unlink-identity";

describe("canUnlinkIdentity", () => {
    it("allows unlink when more than one identity exists", () => {
        expect(
            canUnlinkIdentity([
                { identity_id: "1", provider: "google" } as never,
                { identity_id: "2", provider: "github" } as never,
            ])
        ).toBe(true);
    });

    it("blocks unlink when only one identity remains", () => {
        expect(
            canUnlinkIdentity([
                { identity_id: "1", provider: "github" } as never,
            ])
        ).toBe(false);
    });

    it("blocks unlink when identities are empty", () => {
        expect(canUnlinkIdentity([])).toBe(false);
    });
});
