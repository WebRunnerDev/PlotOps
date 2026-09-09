import { describe, expect, it } from "vitest";

import { BOOT_MIN_VISIBLE_MS } from "./use-boot-visible";

describe("boot visible hold", () => {
    it("exposes a min window long enough for letter choreography", () => {
        // Letter rise finishes ~0.08 + 6*0.04 + 0.7 ≈ 1.0s; hold covers the beat.
        expect(BOOT_MIN_VISIBLE_MS).toBeGreaterThanOrEqual(900);
        expect(BOOT_MIN_VISIBLE_MS).toBeLessThanOrEqual(1600);
    });
});
