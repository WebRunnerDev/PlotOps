import { describe, expect, it } from "vitest";

import { BOOT_MIN_VISIBLE_MS } from "./use-boot-visible";

describe("boot visible hold", () => {
    it("exposes a min window long enough for letter choreography", () => {
        // Masked rise finishes ~0.12 + 6*0.055 + 0.85 ≈ 1.3s worst letter;
        // hold covers the primary beat so fast boots still show the moment.
        expect(BOOT_MIN_VISIBLE_MS).toBeGreaterThanOrEqual(900);
        expect(BOOT_MIN_VISIBLE_MS).toBeLessThanOrEqual(1600);
    });
});
