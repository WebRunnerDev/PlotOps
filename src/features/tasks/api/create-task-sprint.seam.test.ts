import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("createTaskRecord sprint assign seam", () => {
    it("persists optional sprint_id and sprint_position on insert", () => {
        const source = readFileSync(path.join(dirname, "tasks-api.ts"), "utf8");

        expect(source).toMatch(/sprintId\?:\s*string/);
        expect(source).toMatch(/sprint_id:\s*sprintId/);
        expect(source).toMatch(/sprint_position:\s*sprintPosition/);
    });

    it("resolves omitted taskType from boards.default_task_type", () => {
        const source = readFileSync(path.join(dirname, "tasks-api.ts"), "utf8");

        expect(source).toMatch(/taskType\?:\s*TaskType/);
        expect(source).toMatch(/default_task_type/);
        expect(source).toMatch(/task_type:\s*resolvedType/);
    });
});
