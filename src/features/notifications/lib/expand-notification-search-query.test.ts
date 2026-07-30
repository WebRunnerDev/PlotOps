import { describe, expect, it } from "vitest";

import {
    expandNotificationSearchQuery,
    fuzzyTextMatch,
} from "@/features/notifications/lib/expand-notification-search-query";

describe("expandNotificationSearchQuery", () => {
    it("matches Assigned UI copy to assignment kinds", () => {
        const result = expandNotificationSearchQuery("assigned");
        expect(result.matchedKinds).toEqual(
            expect.arrayContaining(["assignment", "assignee_change"])
        );
    });

    it("matches Russian assignment copy", () => {
        const result = expandNotificationSearchQuery("назначен");
        expect(result.matchedKinds).toContain("assignment");
    });

    it("matches Russian assignee cases via shared stem", () => {
        const result = expandNotificationSearchQuery("исполнителем");
        expect(result.matchedKinds).toContain("assignee_change");
    });

    it("matches Russian assignment case variants", () => {
        const result = expandNotificationSearchQuery("назначенного");
        expect(result.matchedKinds).toContain("assignment");
    });

    it("tolerates a small typo in Assigned", () => {
        const result = expandNotificationSearchQuery("assigend");
        expect(result.matchedKinds).toEqual(
            expect.arrayContaining(["assignment", "assignee_change"])
        );
    });

    it("matches Russian status copy", () => {
        const result = expandNotificationSearchQuery("статус");
        expect(result.matchedKinds).toContain("status_change");
    });

    it("maps Russian priority label to metadata token", () => {
        const result = expandNotificationSearchQuery("срочный");
        expect(result.extraPatterns).toContain("urgent");
    });

    it("maps Russian priority case variant", () => {
        const result = expandNotificationSearchQuery("срочного");
        expect(result.extraPatterns).toContain("urgent");
    });

    it("returns empty expansion for blank query", () => {
        expect(expandNotificationSearchQuery("   ")).toEqual({
            extraPatterns: [],
            matchedKinds: [],
        });
    });

    it("matches Mention UI copy to mention kind", () => {
        const result = expandNotificationSearchQuery("mentioned");
        expect(result.matchedKinds).toContain("mention");
    });

    it("matches Russian Mention copy", () => {
        const result = expandNotificationSearchQuery("упомянул");
        expect(result.matchedKinds).toContain("mention");
    });

    it("matches Russian Mention noun via shared stem", () => {
        const result = expandNotificationSearchQuery("упоминание");
        expect(result.matchedKinds).toContain("mention");
    });
});

describe("fuzzyTextMatch", () => {
    it("matches Russian case forms by prefix stem", () => {
        expect(fuzzyTextMatch("исполнитель изменён", "исполнителем")).toBe(
            true
        );
    });

    it("matches single-character typos", () => {
        expect(fuzzyTextMatch("assigned", "assigend")).toBe(true);
    });
});
