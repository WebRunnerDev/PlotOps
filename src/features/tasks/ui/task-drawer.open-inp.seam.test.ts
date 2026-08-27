import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskDrawer open INP seams", () => {
    it("defers TipTap-heavy body until after first paint (double rAF)", () => {
        const drawer = readFileSync(
            path.join(dirname, "task-drawer.tsx"),
            "utf8"
        );

        expect(drawer).toMatch(/useDeferredMount/);
        expect(drawer).toMatch(
            /useDeferredMount\(Boolean\(task\),\s*task\?\.id\)/
        );
        expect(drawer).toMatch(/heavyReady\s*\?/);
        expect(drawer).toMatch(/TaskCustomFieldsSection/);
        expect(drawer).toMatch(/TaskCommentsSection/);
        // Shell header stays outside the deferred gate.
        expect(drawer).toMatch(
            /DrawerHeader[\s\S]*\{heavyReady\s*\?[\s\S]*TaskCustomFieldsSection/
        );
    });
});
