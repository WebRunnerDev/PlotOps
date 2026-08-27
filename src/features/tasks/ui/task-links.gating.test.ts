import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Task Link Role gating seam", () => {
    it("gates add and remove Task Link on canEditTasks", () => {
        const drawer = readUi("task-drawer.tsx");
        const section = readUi("task-links-section.tsx");

        expect(drawer).toMatch(/TaskLinksSection/);
        expect(drawer).not.toMatch(/relatedTasks\?\.length/);
        expect(drawer).toMatch(/canEditTasks/);
        expect(section).toMatch(/canEdit/);
        expect(section).toMatch(/taskLinks\.relatesTo/);
        expect(section).toMatch(/taskLinks\.blocks/);
        expect(section).toMatch(/taskLinks\.blockedBy/);
        expect(section).toMatch(/collectTaskLinkCandidates/);
        expect(section).toMatch(/useProjectTasks/);
        expect(section).toMatch(/TaskSearchPicker/);
        const picker = readUi("task-search-picker.tsx");
        expect(picker).toMatch(/<BoardTaskFiltersBar/);
        expect(picker).toMatch(/taskLinks\.otherBoard/);
        expect(picker.indexOf("<BoardTaskFiltersBar")).toBeGreaterThan(
            picker.indexOf("<ComboboxContent")
        );
        expect(section).toMatch(/createTaskLink/);
        expect(section).toMatch(/deleteTaskLink/);
        expect(section).not.toMatch(/canCreateTasks/);
    });
});
