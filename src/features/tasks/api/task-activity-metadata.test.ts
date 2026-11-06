import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/supabase", () => ({ supabase: {} }));

const { parseMetadata } = await import("./task-activity-api");

describe("parseMetadata auto-link", () => {
    it("keeps the task key an automatic link matched", () => {
        expect(
            parseMetadata({
                auto_link: { key: "TASK-1" },
                changes: [{ field: "branch", from: null, to: "TASK-1-login" }],
                source: "github_webhook",
            })
        ).toEqual({
            autoLinkKey: "TASK-1",
            changes: [{ field: "branch", from: null, to: "TASK-1-login" }],
            source: "github_webhook",
        });
    });

    it("leaves manual links without the auto-link key", () => {
        expect(
            parseMetadata({
                auto_link: "yes",
                changes: [{ field: "branch", from: null, to: "x" }],
            })
        ).not.toHaveProperty("autoLinkKey");
    });
});
