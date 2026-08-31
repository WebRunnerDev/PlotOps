import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("TaskSearchPicker seam", () => {
    it("shows task status and supports hiding completed tasks", () => {
        const picker = readUi("task-search-picker.tsx");
        const subtasks = readUi("task-subtasks-section.tsx");
        const links = readUi("task-links-section.tsx");

        expect(picker).toMatch(/resolveTaskStatusName/);
        expect(picker).toMatch(/fields\.status/);
        expect(picker).toMatch(/hideCompletedBoardTasks/);
        expect(picker).toMatch(/onHideCompletedChange/);

        expect(subtasks).toMatch(/projectId=\{projectId\}/);
        expect(links).toMatch(/projectId=\{projectId\}/);
    });
});
