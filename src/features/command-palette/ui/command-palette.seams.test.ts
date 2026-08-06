import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Command palette local reset seam", () => {
    it("resets query on close but keeps in-flight create guard", () => {
        const source = readUi("command-palette.tsx");

        expect(source).toMatch(/resetCommandPaletteLocalState/);
        expect(source).toMatch(
            /useEffect\(\(\)\s*=>\s*\{[\s\S]*if\s*\(isOpen\)\s*return/
        );
        expect(source).toMatch(/setQuery\(reset\.query\)/);
        expect(source).not.toMatch(/setIsCreating\(reset\.isCreating\)/);
    });
});

describe("Command palette create-task columnsReady seam", () => {
    it("gates create on columnsReady via resolveCreateTaskColumnGate", () => {
        const source = readUi("command-palette.tsx");

        expect(source).toMatch(/columnsReady/);
        expect(source).toMatch(/columnsError/);
        expect(source).toMatch(/resolveCreateTaskColumnGate/);
        expect(source).toMatch(/createColumnGate\s*===\s*"loading"/);
        expect(source).toMatch(/createColumnGate\s*===\s*"error"/);
        expect(source).toMatch(/command:columnsLoading/);
        expect(source).toMatch(/command:columnsLoadFailed/);
    });
});

describe("Command palette active sprint create seam", () => {
    it("passes resolveCreateTaskSprintId into createTask", () => {
        const source = readUi("command-palette.tsx");

        expect(source).toMatch(/resolveCreateTaskSprintId/);
        expect(source).toMatch(/sprintId:\s*createSprintId/);
    });
});

describe("Command palette navigate + typed create seam", () => {
    it("wires resolveNavigateIntent to TopBar section routes", () => {
        const source = readUi("command-palette.tsx");

        expect(source).toMatch(/resolveNavigateIntent/);
        expect(source).toMatch(
            /to:\s*"\/projects\/\$projectId\/boards\/\$boardId"/
        );
        expect(source).toMatch(
            /to:\s*"\/projects\/\$projectId\/boards\/\$boardId\/backlog"/
        );
        expect(source).toMatch(/to:\s*"\/projects\/\$projectId\/ci-cd"/);
        expect(source).toMatch(/to:\s*"\/projects\/\$projectId\/settings"/);
    });

    it("threads create-task taskType into createTask options", () => {
        const source = readUi("command-palette.tsx");

        expect(source).toMatch(
            /resolveCreateTaskIntent\(routeContext,\s*query,\s*taskType\)/
        );
        expect(source).toMatch(/taskType:\s*intent\.taskType/);
        expect(source).toMatch(/command:createBugWithTitle/);
        expect(source).toMatch(/command:createFeatureWithTitle/);
    });
});
