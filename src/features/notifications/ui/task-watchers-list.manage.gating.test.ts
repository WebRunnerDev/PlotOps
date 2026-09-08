import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Manage Watchers UI Role gating seam", () => {
    it("gates manage-others on canManageWatchers and excludes Guest", () => {
        const list = readUi("task-watchers-list.tsx");
        const hooks = readFileSync(
            path.join(dirname, "../model/use-task-watchers.ts"),
            "utf8"
        );

        expect(list).toMatch(/useProjectAccess/);
        expect(list).toMatch(/canManageWatchers/);
        expect(list).toMatch(/isGuest/);
        expect(list).toMatch(
            /canManageWatchers\s*&&\s*!guest|!guest\s*&&\s*canManageWatchers/
        );
        expect(list).toMatch(/eligibleWatcherAddCandidates|AddWatcher/);
        expect(list).toMatch(/watchers\.add|watchers\.manage|watchers\.remove/);
        expect(list).toMatch(/toast\.error/);

        // Mutations must pass target userId for manage-others.
        expect(hooks).toMatch(/addTaskWatch\([\s\S]*userId/);
        expect(hooks).toMatch(/removeTaskWatch\([\s\S]*userId/);
    });

    it("keeps self Watch/Unwatch for all Roles including Viewer", () => {
        const list = readUi("task-watchers-list.tsx");

        expect(list).toMatch(/useToggleTaskWatch/);
        expect(list).toMatch(/watchers\.watch|watchers\.unwatch/);
    });
});
