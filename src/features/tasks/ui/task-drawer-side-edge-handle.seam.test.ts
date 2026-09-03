import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskDrawerSideEdgeHandle seam", () => {
    it("uses a grab drag handle (not resize) and can dismiss past min width", () => {
        const source = readFileSync(
            path.join(dirname, "task-drawer-side-edge-handle.tsx"),
            "utf8"
        );

        expect(source).toMatch(/resolveSideDrawerPointerDrag/);
        expect(source).toMatch(/onClose/);
        expect(source).toMatch(/shouldClose/);
        expect(source).toMatch(/stopPropagation/);
        expect(source).toMatch(/cursor-grab/);
        expect(source).toMatch(/active:cursor-grabbing/);
        expect(source).toMatch(/uiSettings\.dragDrawer/);
        expect(source).toMatch(/role="slider"/);
        expect(source).not.toMatch(/cursor-ew-resize/);
        expect(source).not.toMatch(/role="separator"/);
        expect(source).not.toMatch(/absolute inset-y-0/);
    });
});
