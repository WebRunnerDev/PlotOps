import { describe, expect, it } from "vitest";

import { defaultPullRequestTitle } from "@/features/git-integration/lib/default-pull-request-title";

describe("defaultPullRequestTitle", () => {
    it("joins task key and title", () => {
        expect(
            defaultPullRequestTitle({ key: "TASK-12", title: "Login page" })
        ).toBe("TASK-12: Login page");
    });
});
