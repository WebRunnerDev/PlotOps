import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("KanbanBoard refetch error seam", () => {
    it("only blocks the board on columns/tasks failures without cached data", () => {
        const source = readFileSync(
            path.join(dirname, "kanban-board.tsx"),
            "utf8"
        );

        expect(source).toMatch(/columnsReady/);
        expect(source).toMatch(/tasksReady/);
        expect(source).toMatch(/blockingError/);
        expect(source).not.toMatch(
            /columnsApi\.error\s*\?\?\s*labelsApi\.error\s*\?\?\s*tasksApi\.error/
        );
        expect(source).not.toMatch(/sprintsQueryError/);
    });
});
