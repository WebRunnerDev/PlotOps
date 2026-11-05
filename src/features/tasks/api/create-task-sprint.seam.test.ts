import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("createTaskRecord sprint assign seam", () => {
    it("creates via create_task RPC so SPA and MCP share position/type/author", () => {
        const source = readFileSync(path.join(dirname, "tasks-api.ts"), "utf8");

        expect(source).toMatch(/rpc\("create_task"/);
        expect(source).toMatch(/p_board_id:\s*boardId/);
        expect(source).toMatch(/p_title:\s*normalizeTaskTitle/);
        expect(source).toMatch(/p_options:\s*asJson\(options\)/);
        expect(source).not.toMatch(/\.from\("tasks"\)[\s\S]*\.insert\(/);
    });

    it("passes optional sprint_id in create_task options", () => {
        const source = readFileSync(path.join(dirname, "tasks-api.ts"), "utf8");

        expect(source).toMatch(/sprintId\?:\s*string/);
        expect(source).toMatch(/options\.sprint_id\s*=\s*sprintId/);
    });

    it("passes omitted taskType through so the RPC reads boards.default_task_type", () => {
        const source = readFileSync(path.join(dirname, "tasks-api.ts"), "utf8");

        expect(source).toMatch(/taskType\?:\s*TaskType/);
        expect(source).toMatch(/options\.task_type\s*=\s*taskType/);
        expect(source).not.toMatch(/default_task_type/);
    });

    it("lets the RPC auto-assign on a solo Team when assigneeId is omitted", () => {
        const source = readFileSync(path.join(dirname, "tasks-api.ts"), "utf8");

        expect(source).not.toMatch(/shouldAutoAssignToCreator/);
        expect(source).not.toMatch(/auto_assign_to_creator/);
        expect(source).toMatch(/options\.assignee_id\s*=\s*extras\.assigneeId/);
    });

    it("accepts optional priority and assigneeId overrides on create", () => {
        const source = readFileSync(path.join(dirname, "tasks-api.ts"), "utf8");

        expect(source).toMatch(/assigneeId\?:\s*null\s*\|\s*string/);
        expect(source).toMatch(/priority\?:\s*null\s*\|\s*TaskPriority/);
        expect(source).toMatch(/extras\?\.assigneeId\s*[!=]==\s*undefined/);
        expect(source).toMatch(/extras\?\.priority\s*[!=]==\s*undefined/);
    });
});
