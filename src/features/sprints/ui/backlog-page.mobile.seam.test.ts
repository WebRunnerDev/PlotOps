import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readSource(filename: string) {
    return readFileSync(path.join(dirname, filename), "utf8");
}

describe("BacklogPage mobile seam", () => {
    it("uses min-w-0 page shell and full-width draft/search controls on narrow viewports", () => {
        const page = readSource("backlog-page.tsx");

        expect(page).toMatch(/min-w-0 max-w-6xl/);
        expect(page).toMatch(/w-full sm:max-w-xs/);
        expect(page).toMatch(/w-full min-w-0 sm:max-w-sm/);
        expect(page).toMatch(
            /max-w-full flex-col items-stretch gap-2[\s\S]*sm:flex-row sm:flex-wrap sm:items-center/
        );
    });
});

describe("SprintTaskTable mobile seam", () => {
    it("renders a single-column card list before the sm table breakpoint", () => {
        const table = readSource("sprint-task-table.tsx");

        expect(table).toMatch(/divide-y divide-border sm:hidden/);
        expect(table).toMatch(/DraggableTaskCard/);
        expect(table).toMatch(/hidden sm:block/);
    });
});

describe("Sprint lifecycle dialogs mobile seam", () => {
    it("keeps close dialog scrollable and carryover controls stacked on mobile", () => {
        const dialogs = readSource("sprint-lifecycle-dialogs.tsx");

        expect(dialogs).toMatch(/max-h-\[85dvh\][\s\S]*min-w-0/);
        expect(dialogs).toMatch(/flex-col gap-2 sm:flex-row sm:items-center/);
        expect(dialogs).toMatch(/w-full[\s\S]*sm:w-48/);
    });
});

describe("SprintInsightsPanel mobile seam", () => {
    it("stacks KPI cards in one column before sm", () => {
        const panel = readSource("sprint-insights-panel.tsx");

        expect(panel).toMatch(/grid-cols-1/);
        expect(panel).toMatch(/sm:grid-cols-2/);
    });
});
