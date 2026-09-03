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
        expect(drawer).toMatch(/canSetParent/);
        expect(drawer).toMatch(/canEditTasks/);
        expect(section).toMatch(/canAdd/);
        expect(section).toMatch(/canSetParent/);
        expect(section).toMatch(/setTaskParent/);
        expect(section).toMatch(/TaskSearchPicker/);
        expect(section).toMatch(/collectSubtaskLinkCandidates/);
        expect(section).toMatch(/collectParentTaskCandidates/);
        expect(section).not.toMatch(/canCreateTasks/);
    });

    it("gates Remove parent on canCreateTasks so Contributors cannot mint a root Task", () => {
        const drawer = readUi("task-drawer.tsx");
        const section = readUi("task-subtasks-section.tsx");

        expect(drawer).toMatch(/canCreateTasks/);
        expect(drawer).toMatch(/canRemoveParent/);
        expect(section).toMatch(/clearTaskParent/);
    });
});

describe("Subtask drawer list seam", () => {
    it("animates drawer content when switching to a Subtask", () => {
        const drawer = readUi("task-drawer.tsx");
        const section = readUi("task-subtasks-section.tsx");

        expect(drawer).toMatch(/shouldAnimateTaskSwap/);
        expect(drawer).toMatch(/resolveTaskSwapAnimation/);
        expect(drawer).toMatch(/taskSwapEpoch/);
        expect(drawer).toMatch(/slide-in-from-right-4/);
        expect(drawer).toMatch(/slide-in-from-left-4/);
        expect(section).toMatch(/selectTask\(child\.id\)/);
        expect(section).toMatch(/transition-colors/);
    });

    it("shows Parent Task in the Subtasks section when viewing a Subtask", () => {
        const drawer = readUi("task-drawer.tsx");
        const section = readUi("task-subtasks-section.tsx");

        expect(drawer).not.toMatch(/subtasks\.parentBadge/);
        expect(drawer).toMatch(/canRemoveParent/);
        expect(section).toMatch(/subtasks\.parentTitle/);
        expect(section).toMatch(/task\.parentId/);
    });

    it("shows status and assignee on each Subtask row", () => {
        const section = readUi("task-subtasks-section.tsx");

        expect(section).toMatch(/task\.status/);
        expect(section).toMatch(/task\.assignee/);
        expect(section).toMatch(/fields\.memberNone/);
    });

    it("keeps add form open when switching create/link mode from an empty title input", () => {
        const section = readUi("task-subtasks-section.tsx");

        expect(section).toMatch(/isAddFormInteractionTarget/);
        expect(section).toMatch(/skipBlurClose\.current = true/);
        expect(section).toMatch(/data-slot=select-content/);
    });
});

describe("Subtask card badge seam", () => {
    it("shows the Parent Task key on Subtask cards", () => {
        const card = readUi("task-card.tsx");

        expect(card).toMatch(/task\.parentKey/);
        expect(card).toMatch(/subtasks\.parentBadge/);
        expect(card).toMatch(/task\.hasOpenBlocker/);
        expect(card).toMatch(/taskLinks\.blockerBadge/);
    });
});
