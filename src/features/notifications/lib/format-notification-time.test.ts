import { describe, expect, it } from "vitest";

import { formatNotificationRelativeTime } from "./format-notification-time";

const NOW = new Date("2026-11-22T12:00:00.000Z");

function relative(createdAt: string, locale = "en") {
    return formatNotificationRelativeTime(createdAt, {
        justNowLabel: "just now",
        locale,
        now: NOW,
    });
}

describe("formatNotificationRelativeTime", () => {
    it("says just now under a minute", () => {
        expect(relative("2026-11-22T11:59:30.000Z")).toBe("just now");
    });

    it("uses a relative distance within a week", () => {
        expect(relative("2026-11-22T11:55:00.000Z")).toBe("5 minutes ago");
        expect(relative("2026-11-20T12:00:00.000Z")).toBe("2 days ago");
    });

    it("localizes the relative distance", () => {
        expect(relative("2026-11-22T09:00:00.000Z", "ru")).toBe("3 часа назад");
    });

    it("falls back to a calendar date past a week", () => {
        expect(relative("2026-10-01T12:00:00.000Z")).toBe("Oct 1");
        expect(relative("2025-10-01T12:00:00.000Z")).toBe("Oct 1, 2025");
    });

    it("returns an empty string for an invalid date", () => {
        expect(relative("not-a-date")).toBe("");
    });
});
