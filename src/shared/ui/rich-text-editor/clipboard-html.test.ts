import { describe, expect, it } from "vitest";

import { shouldPreferClipboardHtml } from "@/shared/ui/rich-text-editor/clipboard-html";

describe("shouldPreferClipboardHtml", () => {
    it("prefers HTML when Notion wraps a table in a full clipboard document", () => {
        const html = `
            <html><body><!--StartFragment-->
            <table style="width:336px">
              <colgroup><col><col></colgroup>
              <tbody>
                <tr><td>Name</td><td>Status</td></tr>
                <tr><td>Login</td><td>Done</td></tr>
              </tbody>
            </table>
            <!--EndFragment--></body></html>
        `;

        expect(shouldPreferClipboardHtml(html)).toBe(true);
    });

    it("prefers HTML for Jira / Confluence tables", () => {
        const html = `
            <table class="confluenceTable">
              <tbody>
                <tr><th class="confluenceTh">Col</th></tr>
                <tr><td class="confluenceTd"><p>cell</p></td></tr>
              </tbody>
            </table>
        `;

        expect(shouldPreferClipboardHtml(html)).toBe(true);
    });

    it("does not steal a plain image paste", () => {
        expect(
            shouldPreferClipboardHtml('<img src="blob:https://example/1">')
        ).toBe(false);
        expect(shouldPreferClipboardHtml("")).toBe(false);
    });
});
