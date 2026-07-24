import { describe, expect, it } from "vitest";

import {
    buildStatusAccentClass,
    buildStatusTone,
} from "@/features/ci-cd/model/build-status";

describe("CI build status accents", () => {
    it("maps success and failure to distinct neon tones", () => {
        expect(buildStatusTone("success")).toBe("success");
        expect(buildStatusTone("failure")).toBe("failure");
        expect(buildStatusAccentClass("success")).toContain("emerald");
        expect(buildStatusAccentClass("failure")).toContain("red");
    });
});
