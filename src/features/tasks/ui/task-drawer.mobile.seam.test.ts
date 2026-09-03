import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tasksUiDirectory = path.dirname(fileURLToPath(import.meta.url));
const gitUiDirectory = path.join(tasksUiDirectory, "../../git-integration/ui");

describe("TaskDrawer mobile seam", () => {
    it("uses preferred placement with bottom-sheet snap points when side is bottom", () => {
        const source = readFileSync(
            path.join(tasksUiDirectory, "task-drawer.tsx"),
            "utf8"
        );

        expect(source).toMatch(/resolveTaskDrawerPlacement/);
        expect(source).toMatch(/useTaskDrawerPreferencesStore/);
        expect(source).toMatch(
            /swipeDirection=\{drawerPlacement\.swipeDirection\}/
        );
        expect(source).toMatch(/showSwipeHandle/);
        expect(source).toMatch(/TASK_DRAWER_SNAP_POINTS/);
        expect(source).toMatch(/drawerPlacement\.useSnapPoints/);
        expect(source).not.toMatch(/defaultSnapPoint/);
        expect(source).toMatch(/@container\/task-drawer/);
        expect(source).toMatch(/min-h-0[\s\S]*flex-1[\s\S]*overflow-y-auto/);
        expect(source).toMatch(
            /grid-cols-1[\s\S]*@3xl\/task-drawer:grid-cols-\[minmax\(0,2fr\)_auto_minmax\(0,1fr\)\]/
        );
        expect(source).toMatch(/hidden @3xl\/task-drawer:block/);
        expect(source).not.toMatch(
            /md:grid-cols-\[minmax\(0,2fr\)_auto_minmax\(0,1fr\)\]/
        );
        expect(source).toMatch(/TaskDrawerSideEdgeHandle/);
        expect(source).toMatch(/showSwipeHandle=\{!drawerPlacement\.isSide\}/);
        expect(source).toMatch(/setSideDrawerWidthPx/);
        expect(source).toMatch(/flex-row gap-3/);
        expect(source).toMatch(/drawerSide === "left"/);
        expect(source).toMatch(/drawerSide === "right"/);
    });
});

describe("TaskActivitySection mobile seam", () => {
    it("caps expanded activity feed height with internal scroll", () => {
        const source = readFileSync(
            path.join(tasksUiDirectory, "task-activity-section.tsx"),
            "utf8"
        );

        expect(source).toMatch(/max-h-\[min\(/);
        expect(source).toMatch(/overflow-y-auto/);
    });
});

describe("TaskGithubPanel mobile seam", () => {
    it("stacks branch and PR link rows on narrow viewports", () => {
        const source = readFileSync(
            path.join(tasksUiDirectory, "task-github-panel.tsx"),
            "utf8"
        );

        expect(source).toMatch(/flex-col gap-2 sm:flex-row sm:items-center/);
        expect(source).toMatch(/min-w-0/);
    });
});

describe("PrDiffDialog mobile seam", () => {
    it("uses full-viewport layout and unified diff on mobile", () => {
        const source = readFileSync(
            path.join(gitUiDirectory, "pr-diff-dialog.tsx"),
            "utf8"
        );

        expect(source).toMatch(/max-sm:h-dvh/);
        expect(source).toMatch(/max-sm:translate-x-0 max-sm:translate-y-0/);
        expect(source).toMatch(/DiffModeEnum\.Unified/);
        expect(source).toMatch(/max-sm:hidden/);
    });
});

describe("BoardArchiveDialog mobile seam", () => {
    it("fits archived task list on narrow viewports without horizontal bleed", () => {
        const source = readFileSync(
            path.join(tasksUiDirectory, "board-archive-dialog.tsx"),
            "utf8"
        );

        expect(source).toMatch(/min-w-0/);
        expect(source).toMatch(/max-h-\[min\(/);
        expect(source).toMatch(/flex-wrap gap-2/);
    });
});
