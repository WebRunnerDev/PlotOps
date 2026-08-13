import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Subtask Role gating seam", () => {
    it("gates Add Subtask on canEditTasks, not canCreateTasks", () => {
        const drawer = readUi("task-drawer.tsx");
        const section = readUi("task-subtasks-section.tsx");

        expect(drawer).toMatch(/canAddSubtask/);
        expect(drawer).toMatch(/canEditTasks/);
        expect(section).toMatch(/canAdd/);
        expect(section).not.toMatch(/canCreateTasks/);
    });

    it("gates Remove parent on canCreateTasks so Contributors cannot mint a root Task", () => {
        const drawer = readUi("task-drawer.tsx");

        expect(drawer).toMatch(/canCreateTasks/);
        expect(drawer).toMatch(/canRemoveParent/);
        expect(drawer).toMatch(/clearTaskParent/);
    });
});

describe("Subtask card badge seam", () => {
    it("shows the Parent Task key on Subtask cards", () => {
        const card = readUi("task-card.tsx");

        expect(card).toMatch(/task\.parentKey/);
        expect(card).toMatch(/subtasks\.parentBadge/);
    });
});
