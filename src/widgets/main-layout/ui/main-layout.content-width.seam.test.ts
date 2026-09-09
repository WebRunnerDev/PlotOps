import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../.."
);

function read(relativePath: string): string {
    return readFileSync(path.join(root, relativePath), "utf8");
}

/** Shared content width for non-kanban app pages (home, settings, backlog, …). */
const CONTENT_MAX_WIDTH = "max-w-6xl";

/**
 * Atmosphere pages pad the text (`px-4`) while `bg-auth-atmosphere` stays
 * `inset-x-0` on the same root — so copy sits inside the decorative grid.
 * MainLayout owns only max-width (no p-4), otherwise text and grid share an edge.
 */
const ATMOSPHERE_DEFAULT_PAGES = [
    "src/features/teams/ui/teams-page.tsx",
    "src/routes/(main)/about.tsx",
    "src/routes/(main)/settings.tsx",
    "src/routes/(main)/teams/$teamId/settings.tsx",
] as const;

const PROJECT_MODE_PAGE_SHELLS = [
    "src/features/ci-cd/ui/ci-cd-loading.tsx",
    "src/features/ci-cd/ui/ci-cd-page.tsx",
    "src/features/sprints/ui/backlog-page.tsx",
    "src/routes/(main)/projects/$projectId/settings.tsx",
] as const;

describe("MainLayout content width seam", () => {
    it(`caps default content at ${CONTENT_MAX_WIDTH} without layout padding`, () => {
        const source = read("src/widgets/main-layout/ui/main-layout.tsx");

        expect(source).toMatch(
            new RegExp(
                String.raw`mx-auto w-full ${CONTENT_MAX_WIDTH} \[view-transition-name:main-content\]`
            )
        );
        expect(source).not.toMatch(
            new RegExp(String.raw`${CONTENT_MAX_WIDTH} p-\d+`)
        );
        expect(source).not.toMatch(/max-w-5xl/);
    });

    it("keeps atmosphere page text inset via px while layout owns max-width", () => {
        for (const relativePath of ATMOSPHERE_DEFAULT_PAGES) {
            const source = read(relativePath);
            expect(
                source,
                `${relativePath} must pad text away from atmosphere grid`
            ).toMatch(/\bpx-4\b/);
            expect(
                source,
                `${relativePath} must not set content-shell max-w-5xl/6xl (MainLayout owns it)`
            ).not.toMatch(/max-w-[56]xl/);
        }
    });

    it(`aligns project-mode page shells on ${CONTENT_MAX_WIDTH}`, () => {
        for (const relativePath of PROJECT_MODE_PAGE_SHELLS) {
            const source = read(relativePath);
            expect(source, relativePath).toMatch(new RegExp(CONTENT_MAX_WIDTH));
            expect(source, relativePath).not.toMatch(/max-w-5xl/);
        }
    });
});
