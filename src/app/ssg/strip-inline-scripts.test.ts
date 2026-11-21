import { describe, expect, it } from "vitest";

import { stripInlineScripts } from "./strip-inline-scripts";

describe("stripInlineScripts", () => {
    it("removes the router hydration bootstrap script", () => {
        const html =
            '<main>hi</main><script>(self.$R=self.$R||{})["tsr"]=[];self.$_TSR={}</script>';

        expect(stripInlineScripts(html)).toBe("<main>hi</main>");
    });

    it("removes inline scripts that carry other attributes", () => {
        expect(
            stripInlineScripts(
                '<script nonce="x" data-tsr-stream-part>a()</script>'
            )
        ).toBe("");
    });

    it("matches end tags with trailing whitespace", () => {
        expect(stripInlineScripts("a<script>b()</script >c")).toBe("ac");
    });

    it("does not leave a script spliced together by a removal", () => {
        expect(
            stripInlineScripts("<scr<script>x</script>ipt>evil()</script>")
        ).toBe("");
    });

    it("keeps external scripts and JSON data blocks", () => {
        const html = [
            '<script type="module" src="/assets/index.js"></script>',
            '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
            '<script type="application/json">{}</script>',
        ].join("");

        expect(stripInlineScripts(html)).toBe(html);
    });
});
