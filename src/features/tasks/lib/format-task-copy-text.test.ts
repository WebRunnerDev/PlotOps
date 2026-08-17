import { describe, expect, it } from "vitest";

import { formatTaskCopyText } from "@/features/tasks/lib/format-task-copy-text";

describe("formatTaskCopyText", () => {
    it("joins title and plain description with a blank line", () => {
        expect(
            formatTaskCopyText("Fix login", "<p>Reset the session cookie.</p>")
        ).toBe("Fix login\n\nReset the session cookie.");
    });

    it("returns only the title when the description is empty", () => {
        expect(formatTaskCopyText("Fix login", "<p></p>")).toBe("Fix login");
    });
});
