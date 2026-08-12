import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tasksUiDirectory = path.dirname(fileURLToPath(import.meta.url));
const gitUiDirectory = path.join(tasksUiDirectory, "../../git-integration/ui");

describe("TaskDrawer mobile seam", () => {
    it("uses a bottom sheet with snap points and a scrollport for drawer body", () => {
        const source = readFileSync(
            path.join(tasksUiDirectory, "task-drawer.tsx"),
            "utf8"
        );

        expect(source).toMatch(/swipeDirection="down"/);
        expect(source).toMatch(/showSwipeHandle/);
        expect(source).toMatch(/TASK_DRAWER_SNAP_POINTS/);
        expect(source).toMatch(/min-h-0[\s\S]*flex-1[\s\S]*overflow-y-auto/);
        expect(source).toMatch(/min-w-0 flex-\[2_1_0%\]/);
        expect(source).toMatch(/min-w-0 flex-\[1_1_0%\]/);
        expect(source).toMatch(/md:flex-row/);
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
