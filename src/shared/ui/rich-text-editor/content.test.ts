import { describe, expect, it } from "vitest";

import {
    formatImagePlainTextReference,
    richTextToPlainText,
} from "@/shared/ui/rich-text-editor/content";

describe("formatImagePlainTextReference", () => {
    it("uses alt text when present", () => {
        expect(formatImagePlainTextReference("shot")).toBe(" [shot] ");
    });

    it("falls back to a generic label when alt is missing", () => {
        expect(formatImagePlainTextReference()).toBe(" [Image] ");
    });
});

describe("richTextToPlainText", () => {
    it("returns empty string for blank editor HTML", () => {
        expect(richTextToPlainText("<p></p>")).toBe("");
        expect(richTextToPlainText("<p><br></p>")).toBe("");
    });

    it("passes through legacy plain text", () => {
        expect(richTextToPlainText("Just a note")).toBe("Just a note");
    });

    it("keeps paragraph breaks and strips tags", () => {
        expect(
            richTextToPlainText(
                "<p>Hello <strong>world</strong></p><p>Next</p>"
            )
        ).toBe("Hello world\nNext");
    });

    it("decodes entities and keeps image placeholders", () => {
        expect(
            richTextToPlainText(
                '<p>A &amp; B &lt;C&gt;</p><p><img src="/x.png" alt="shot"></p>'
            )
        ).toBe("A & B <C>\n[shot]");
    });

    it("uses a generic image label when alt is missing", () => {
        expect(
            richTextToPlainText(
                '<p>See</p><img src="https://cdn.example/a.png">'
            )
        ).toBe("See\n[Image]");
    });

    it("keeps table rows and separates cells", () => {
        expect(
            richTextToPlainText(
                "<table><tr><th>Name</th><th>Status</th></tr><tr><td>Login</td><td>Done</td></tr></table>"
            )
        ).toBe("Name\tStatus\nLogin\tDone");
    });
});
