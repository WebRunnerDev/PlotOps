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

describe("Command palette include-archived search seam", () => {
    it("opts into archived Task search via toggle and fetch options", () => {
        const source = readUi("command-palette.tsx");

        expect(source).toMatch(/includeArchived/);
        expect(source).toMatch(/command:includeArchived/);
        expect(source).toMatch(
            /useProjectTasks\([\s\S]*\{\s*includeArchived\s*\}/
        );
        expect(source).toMatch(
            /resolveCommandPaletteTaskHits\([\s\S]*\{\s*includeArchived\s*\}/
        );
    });
});

describe("Command palette Search Members seam", () => {
    it("queries Team membership and navigates to Team member settings", () => {
        const source = readUi("command-palette.tsx");

        expect(source).toMatch(/useTeamMembers/);
        expect(source).toMatch(/useTeamOwnerProfile/);
        expect(source).toMatch(/resolveCommandPaletteMemberHits/);
        expect(source).toMatch(/openMemberSettingsIntent/);
        expect(source).toMatch(/to:\s*"\/teams\/\$teamId\/settings"/);
        expect(source).toMatch(/command:members/);
        expect(source).toMatch(/visibility\.searchMembers/);
    });
});

describe("Command palette jump Parent and blockers seam", () => {
    it("wires resolveJumpTaskIntents to select-task for the focused Task", () => {
        const source = readUi("command-palette.tsx");

        expect(source).toMatch(/resolveJumpTaskIntents/);
        expect(source).toMatch(/selectedTaskId/);
        expect(source).toMatch(/includeArchived:\s*true/);
        expect(source).toMatch(/hasOpenBlocker/);
        expect(source).toMatch(/command:goToParent/);
        expect(source).toMatch(/command:goToBlockingTask/);
        expect(source).not.toMatch(/createSubtask/);
        expect(source).not.toMatch(/createTaskLink/);
        expect(source).not.toMatch(/addLink/);
    });
});
