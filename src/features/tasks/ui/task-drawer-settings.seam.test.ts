import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskDrawerSettings seam", () => {
    it("exposes open-after-create and drawer-side controls", () => {
        const source = readFileSync(
            path.join(dirname, "task-drawer-settings.tsx"),
            "utf8"
        );

        expect(source).toMatch(/useTaskDrawerPreferencesStore/);
        expect(source).toMatch(/setOpenAfterCreate/);
        expect(source).toMatch(/setDrawerSide/);
        expect(source).toMatch(/TASK_DRAWER_SIDES/);
        expect(source).toMatch(/uiSettings\.openAfterCreate/);
        expect(source).toMatch(/uiSettings\.drawerSide/);
    });
});

describe("platform settings mounts TaskDrawerSettings", () => {
    it("shows UI prefs for guests and signed-in users", () => {
        const source = readFileSync(
            path.join(dirname, "../../../routes/(main)/settings.tsx"),
            "utf8"
        );

        expect(source).toMatch(/TaskDrawerSettings/);
        expect(source).toMatch(
            /<TaskDrawerSettings \/>[\s\S]*\{guest \? null : \(/
        );
    });
});
