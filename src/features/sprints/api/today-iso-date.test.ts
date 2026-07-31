import { describe, expect, it } from "vitest";

import { defaultSprintEndDate, todayIsoDate } from "./sprints-api";

describe("todayIsoDate", () => {
    it("uses local getFullYear/getMonth/getDate, not UTC ISO", () => {
        // Late evening local — toISOString() may already be the next UTC day.
        const localEvening = new Date(2026, 0, 15, 23, 30, 0);
        const expected = `${localEvening.getFullYear()}-${String(localEvening.getMonth() + 1).padStart(2, "0")}-${String(localEvening.getDate()).padStart(2, "0")}`;

        expect(todayIsoDate(localEvening)).toBe(expected);
        expect(todayIsoDate(localEvening)).toBe("2026-01-15");
    });

    it("pads single-digit month and day", () => {
        expect(todayIsoDate(new Date(2026, 2, 5, 8, 0, 0))).toBe("2026-03-05");
    });
});

describe("defaultSprintEndDate", () => {
    it("adds days on the local calendar basis", () => {
        expect(defaultSprintEndDate("2026-01-01", 14)).toBe("2026-01-14");
        expect(defaultSprintEndDate("2026-01-20", 14)).toBe("2026-02-02");
    });

    it("crosses year boundaries without UTC shift", () => {
        expect(defaultSprintEndDate("2025-12-25", 14)).toBe("2026-01-07");
    });
});
