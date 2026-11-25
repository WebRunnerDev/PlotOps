import { describe, expect, it } from "vitest";

import { isPreviewBranch, PRODUCTION_BRANCH } from "./deploy-environment";

describe("isPreviewBranch", () => {
    it("treats any non-production Pages branch as a preview", () => {
        expect(isPreviewBranch("dev")).toBe(true);
        expect(isPreviewBranch("feat/TASK-165-banner")).toBe(true);
        expect(isPreviewBranch("release-please--branches--main")).toBe(true);
    });

    it("is false for the production branch", () => {
        expect(isPreviewBranch(PRODUCTION_BRANCH)).toBe(false);
    });

    it("is false outside Cloudflare Pages (empty branch)", () => {
        expect(isPreviewBranch("")).toBe(false);
    });
});
