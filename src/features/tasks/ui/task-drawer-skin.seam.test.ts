import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Task drawer skin seam (ADR 0007)", () => {
    it("keeps cobalt drawer chrome: mono key, sharp controls, primary footer", () => {
        const drawer = readUi("task-drawer.tsx");
        const handle = readUi("task-drawer-side-edge-handle.tsx");

        expect(drawer).toMatch(/border-primary\/20/);
        expect(drawer).toMatch(/size-1\.5 shrink-0 bg-primary/);
        expect(drawer).toMatch(/font-mono text-code text-foreground\/80/);
        expect(drawer).toMatch(/rounded-none border-primary\/25/);
        expect(drawer).toMatch(
            /text-meta font-medium tracking-\[0\.06em\] text-muted-foreground/
        );
        expect(drawer).toMatch(/w-full rounded-none font-mono text-code/);
        expect(drawer).toMatch(/border-t border-primary\/20/);
        expect(drawer).toMatch(/hover:bg-primary\/10 hover:text-primary/);
        expect(handle).toMatch(/rounded-none/);
        expect(handle).toMatch(/hover:bg-primary\/70/);
    });

    it("aligns section labels and github panel with density vocabulary", () => {
        const comments = readUi("task-comments-section.tsx");
        const activity = readUi("task-activity-section.tsx");
        const subtasks = readUi("task-subtasks-section.tsx");
        const links = readUi("task-links-section.tsx");
        const github = readUi("task-github-panel.tsx");
        const member = readUi("task-member-field.tsx");

        for (const source of [comments, activity, subtasks, links]) {
            expect(source).toMatch(
                /text-meta font-medium tracking-\[0\.06em\] text-muted-foreground/
            );
        }
        expect(github).toMatch(/rounded-none bg-muted\/40/);
        expect(github).toMatch(/ring-primary\/20/);
        expect(member).toMatch(/rounded-none font-mono text-code/);
    });
});
