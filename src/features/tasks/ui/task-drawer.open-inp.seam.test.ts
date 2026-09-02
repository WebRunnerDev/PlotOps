import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskDrawer open INP seams", () => {
    it("defers TipTap in DescriptionEditor without gating the drawer shell", () => {
        const drawer = readFileSync(
            path.join(dirname, "task-drawer.tsx"),
            "utf8"
        );
        const customFields = readFileSync(
            path.join(
                dirname,
                "../../custom-fields/ui/task-custom-fields-section.tsx"
            ),
            "utf8"
        );

        expect(drawer).not.toMatch(/useDeferredMount/);
        expect(drawer).not.toMatch(/defaultSnapPoint/);
        expect(customFields).toMatch(/useDeferredMount/);
        expect(customFields).toMatch(/useDeferredMount\(true,\s*taskId\)/);
        expect(customFields).toMatch(/RichTextEditor/);
    });
});
