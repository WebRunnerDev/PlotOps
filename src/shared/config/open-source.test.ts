import { describe, expect, it } from "vitest";

import { PLOTOPS_GITHUB_URL, PLOTOPS_LICENSE } from "./open-source";

describe("open-source constants", () => {
    it("exposes a single PlotOps repo URL and MIT license", () => {
        expect(PLOTOPS_LICENSE).toBe("MIT");
        expect(PLOTOPS_GITHUB_URL).toBe(
            "https://github.com/WebRunnerDev/PlotOps"
        );
    });
});
