import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("App chrome narrow viewport seam", () => {
    it("stacks section nav and collapses breadcrumb on small screens", () => {
        const chrome = readUi("app-chrome.tsx");
        const nav = readUi("project-section-nav.tsx");

        expect(chrome).toMatch(/overflow-x-auto/);
        expect(chrome).toMatch(/max-sm:hidden|sm:inline|sm:hidden/);
        expect(chrome).toMatch(/flex-col|sm:absolute/);
        expect(chrome).toMatch(/focus-visible:ring-2/);
        expect(nav).toMatch(/labelShort|nav\.\w+Short/);
        expect(nav).toMatch(/sm:hidden/);
    });
});
