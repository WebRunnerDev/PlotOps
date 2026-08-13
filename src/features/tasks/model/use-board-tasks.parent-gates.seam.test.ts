import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("useBoardTasks Parent Task Done/archive/delete gates", () => {
    it("toasts Done refusal before persistTaskMoves", () => {
        const source = read("src/features/tasks/model/use-board-tasks.ts");
        const domain = read("src/features/tasks/lib/task-structure.ts");

        expect(source).toMatch(/parentDoneRefusal/);
        expect(source).toMatch(/PARENT_GATE_TOAST_KEY/);
        expect(source).toMatch(
            /const moveTasksToColumn = \([\s\S]*parentDoneRefusal[\s\S]*toast\.error[\s\S]*return;[\s\S]*setTasksCache/
        );
        expect(source).toMatch(/persistTaskMoves/);
        expect(domain).toMatch(/subtasks\.doneRefused/);
    });

    it("refuses archive and delete before the provider request", () => {
        const source = read("src/features/tasks/model/use-board-tasks.ts");

        expect(source).toMatch(
            /const archiveTasks = async[\s\S]*assertParentArchiveLegal[\s\S]*archiveTaskMutation\.mutateAsync/
        );
        expect(source).toMatch(
            /deleteTask: async[\s\S]*assertParentDeleteLegal[\s\S]*deleteTaskMutation\.mutateAsync/
        );
    });

    it("board locales include Parent Task gate toasts in en and ru", () => {
        const en = read("src/app/locales/board/en.json");
        const ru = read("src/app/locales/board/ru.json");

        for (const source of [en, ru]) {
            expect(source).toMatch(/"doneRefused"/);
            expect(source).toMatch(/"archiveRefused"/);
            expect(source).toMatch(/"deleteRefused"/);
        }

        expect(en).toMatch(
            "A Parent Task cannot enter Done while Subtasks are not Done"
        );
        expect(en).toMatch(
            "A Parent Task cannot be archived while Subtasks are still active"
        );
        expect(en).toMatch(
            "A Parent Task cannot be deleted while Subtasks exist"
        );
    });
});
