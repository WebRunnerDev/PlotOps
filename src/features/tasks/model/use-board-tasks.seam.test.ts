import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readModel(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("useBoardTasks mutation error + clear seams", () => {
    it("toasts and restores cache on detail/status/drag errors", () => {
        const source = readModel("use-board-tasks.ts");

        expect(source).toMatch(
            /updateTaskDetailsMutation[\s\S]*onError:[\s\S]*toast\.error/
        );
        expect(source).toMatch(
            /updateTaskStatusMutation[\s\S]*onError:[\s\S]*toast\.error/
        );
        expect(source).toMatch(
            /moveTaskMutation[\s\S]*onError:[\s\S]*toast\.error/
        );
        expect(source).toMatch(/previousCache/);
    });

    it("persists description/priority/label clears via null sentinel", () => {
        const source = readModel("use-board-tasks.ts");

        expect(source).toMatch(/description\?:\s*null\s*\|\s*string/);
        expect(source).toMatch(
            /priority\?:\s*null\s*\|\s*Task\["priority"\]|priority\?:\s*null\s*\|\s*TaskPriority/
        );
        expect(source).toMatch(/labelIds\?:\s*null\s*\|\s*string\[\]/);
        expect(source).toMatch(/notifyDeadlineChangeBestEffort/);
        expect(source).toMatch(/updateTaskDetails\(/);
        expect(source).toMatch(/commitTaskDragGesture/);
        expect(source).toMatch(/persist:\s*false|persist\?:\s*boolean/);
    });
});
