import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskDrawerBottomSnapWheel seam", () => {
    it("wheels snap points from the header without owning the drag handle", () => {
        const source = readFileSync(
            path.join(dirname, "task-drawer-bottom-snap-wheel.tsx"),
            "utf8"
        );

        expect(source).toMatch(/useCapturedWheelSession/);
        expect(source).toMatch(/additionalTargets: additionalWheelTargets/);
        expect(source).toMatch(/resolveBottomDrawerWheelStep/);
        expect(source).toMatch(/bottomDrawerWheelIntent/);
        expect(source).toMatch(/onSnapPointChange/);
        expect(source).toMatch(/onClose/);
        expect(source).toMatch(/children/);
        expect(source).not.toMatch(/cursor-grab/);
    });
});
