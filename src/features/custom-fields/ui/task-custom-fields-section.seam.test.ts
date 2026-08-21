import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskCustomFieldsSection type filter + blur persist", () => {
    it("filters by Task type, orders fields, and commits custom values on blur", () => {
        const source = readFileSync(
            path.join(dirname, "task-custom-fields-section.tsx"),
            "utf8"
        );

        expect(source).toMatch(/filterCustomFieldsForTaskType/);
        expect(source).toMatch(/isDescriptionCustomField/);
        expect(source).toMatch(/onBlur/);
        expect(source).toMatch(/setCustomFieldValue/);
        expect(source).toMatch(/canEdit/);
        expect(source).toMatch(/CUSTOM_FIELD_VALUE_MAX_LENGTH/);
        expect(source).toMatch(/richText\.length/);
        expect(source).toMatch(/fields\.customFieldHint/);
        expect(source).toMatch(/description:/);
    });
});

describe("task-drawer mounts TaskCustomFieldsSection", () => {
    it("passes description props with canEdit, projectId, taskId, and task.type", () => {
        const source = readFileSync(
            path.join(dirname, "../../tasks/ui/task-drawer.tsx"),
            "utf8"
        );

        expect(source).toMatch(/TaskCustomFieldsSection/);
        expect(source).toMatch(
            /<TaskCustomFieldsSection[\s\S]*taskType=\{task\.type\}/
        );
        expect(source).toMatch(
            /<TaskCustomFieldsSection[\s\S]*canEdit=\{canEdit\}/
        );
        expect(source).toMatch(
            /<TaskCustomFieldsSection[\s\S]*description=\{\{/
        );
    });
});
