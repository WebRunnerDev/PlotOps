import { describe, expect, it } from "vitest";

import {
    formatTaskCopyHtml,
    formatTaskCopyText,
} from "@/features/tasks/lib/format-task-copy-text";

describe("formatTaskCopyText", () => {
    it("joins title and plain description with a blank line", () => {
        expect(
            formatTaskCopyText("Fix login", "<p>Reset the session cookie.</p>")
        ).toBe("Fix login\n\nReset the session cookie.");
    });

    it("returns only the title when the description is empty", () => {
        expect(formatTaskCopyText("Fix login", "<p></p>")).toBe("Fix login");
    });

    it("uses image placeholders instead of storage urls in plain text", () => {
        const payload = formatTaskCopyText(
            "Bug",
            '<p>See shot</p><img src="https://cdn.example/a.png" alt="shot">'
        );

        expect(payload).not.toContain("https://cdn.example/a.png");
        expect(payload).toBe("Bug\n\nSee shot\n[shot]");
    });
});

describe("formatTaskCopyHtml", () => {
    it("wraps the title and keeps description html with images", () => {
        expect(
            formatTaskCopyHtml(
                "Bug",
                '<p>See shot</p><img src="https://cdn.example/a.png" alt="shot">'
            )
        ).toBe(
            '<p><strong>Bug</strong></p><p>See shot</p><img src="https://cdn.example/a.png" alt="shot">'
        );
    });
});
