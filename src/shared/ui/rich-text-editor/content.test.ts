import { describe, expect, it } from "vitest";

import { richTextToPlainText } from "@/shared/ui/rich-text-editor/content";

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

    it("decodes entities and keeps image urls", () => {
        expect(
            richTextToPlainText(
                '<p>A &amp; B &lt;C&gt;</p><p><img src="/x.png" alt="shot"></p>'
            )
        ).toBe("A & B <C>\n![shot](/x.png)");
    });

    it("keeps bare image src when alt is missing", () => {
        expect(
            richTextToPlainText(
                '<p>See</p><img src="https://cdn.example/a.png">'
            )
        ).toBe("See\nhttps://cdn.example/a.png");
    });

    it("keeps table rows and separates cells", () => {
        expect(
            richTextToPlainText(
                "<table><tr><th>Name</th><th>Status</th></tr><tr><td>Login</td><td>Done</td></tr></table>"
            )
        ).toBe("Name\tStatus\nLogin\tDone");
    });
});
