import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetUiDirectory = dirname;
const routesDirectory = path.join(
    dirname,
    "../../../routes/(main)/projects/$projectId"
);

/** Exact god-bag symbols — not `useBoardTasks` / `useBoardColumns` / etc. */
const GOD_BAG =
    /\bBoardProvider\b|\buseBoardContext\b|(?<![A-Za-z])useBoard(?![A-Za-z])/;
const TASKS_DEEP_IMPORT = /from\s+["']@\/features\/tasks\/(api|model|ui|lib)\//;
const TASKS_SHIM_SYMBOLS =
    /\bBoardSwitcher\b|\bProjectBoardsSettings\b|\bProjectLabelsSettings\b|\bBoardSprintControls\b|\bBacklogPage\b/;

function readSources(directory: string, extensions = [".tsx", ".ts"]) {
    return readdirSync(directory)
        .filter((name) =>
            extensions.some((extension) => name.endsWith(extension))
        )
        .filter(
            (name) => !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")
        )
        .map((name) => ({
            name,
            source: readFileSync(path.join(directory, name), "utf8"),
        }));
}

describe("kanban composition root seam", () => {
    it("board page and kanban widget compose without the god BoardProvider bag", () => {
        for (const file of readSources(widgetUiDirectory)) {
            expect(file.source, file.name).not.toMatch(GOD_BAG);
        }
    });

    it("board page and kanban widget import feature barrels, not deep tasks paths", () => {
        for (const file of readSources(widgetUiDirectory)) {
            expect(file.source, file.name).not.toMatch(TASKS_DEEP_IMPORT);
        }
    });

    it("project board routes do not mount BoardProvider or deep-import tasks internals", () => {
        const routeFiles = [
            path.join(routesDirectory, "settings.tsx"),
            path.join(routesDirectory, "index.tsx"),
            path.join(routesDirectory, "boards/$boardId/index.tsx"),
            path.join(routesDirectory, "boards/$boardId/backlog.tsx"),
        ];

        for (const filePath of routeFiles) {
            const source = readFileSync(filePath, "utf8");
            const name = path.relative(routesDirectory, filePath);
            expect(source, name).not.toMatch(GOD_BAG);
            expect(source, name).not.toMatch(TASKS_DEEP_IMPORT);
        }
    });

    it("tasks barrel no longer re-exports boards, labels, or sprints shims", () => {
        const barrel = readFileSync(
            path.join(dirname, "../../../features/tasks/index.ts"),
            "utf8"
        );
        expect(barrel).not.toMatch(GOD_BAG);
        expect(barrel).not.toMatch(TASKS_SHIM_SYMBOLS);
        expect(barrel).not.toMatch(
            /from\s+["']@\/features\/(boards|labels|sprints)["']/
        );
        expect(barrel).not.toMatch(/temporary shim/i);
    });
});
