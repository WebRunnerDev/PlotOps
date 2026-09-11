import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Backlog skin seam (ADR 0007 craft)", () => {
    it("keeps planning hero: atmosphere, display type, pulse, cobalt border", () => {
        const page = readUi("backlog-page.tsx");

        expect(page).toMatch(/bg-auth-atmosphere/);
        expect(page).toMatch(/clamp\(2\.125rem/);
        expect(page).toMatch(/planningEyebrow/);
        expect(page).toMatch(/PlanningPulseStat/);
        expect(page).toMatch(/ActiveSprintLiveStrip/);
        expect(page).toMatch(/ActiveSprintJumpNav/);
        expect(page).toMatch(/sprintSectionId/);
        expect(page).toMatch(/border-primary\/25/);
        expect(page).toMatch(/motion-reveal/);
        expect(page).toMatch(/rounded-none/);
        expect(page).toMatch(/ActiveSprintJumpNav/);
    });

    it("skins sprint sections with state rails, badges, and magnetic Start", () => {
        const page = readUi("backlog-page.tsx");
        const insights = readUi("sprint-insights-panel.tsx");
        const live = readUi("active-sprint-live-strip.tsx");
        const table = readUi("sprint-task-table.tsx");

        expect(page).toMatch(/BacklogSectionShell/);
        expect(page).toMatch(/SprintStateBadge/);
        expect(page).toMatch(/inset_3px_0_0_0/);
        expect(page).toMatch(/whileHover/);
        expect(page).toMatch(/SPRING_PRESS/);
        expect(page).toMatch(/accent=\{isActive \? "active" : "draft"\}/);
        expect(insights).toMatch(/rounded-none/);
        expect(insights).toMatch(/inset_3px_0_0_0/);
        expect(live).toMatch(/computeSprintTimeline/);
        expect(live).toMatch(/NumberFlow/);
        expect(table).toMatch(/ease-\(--ease-out-expo\)/);
        expect(table).toMatch(/dropHint/);
    });

    it("pairs each Active Sprint strip with a named task section", () => {
        const page = readUi("backlog-page.tsx");
        const live = readUi("active-sprint-live-strip.tsx");

        expect(page).not.toMatch(/sr-only">\{sprint\.name\}/);
        expect(page).toMatch(/headingId=\{sprintHeadingId\(sprint\.id\)\}/);
        expect(page).toMatch(/id=\{isActive \? sprintSectionId\(sprint\.id\)/);
        expect(page).toMatch(/closestScrollRoot/);
        expect(page).toMatch(/preventScroll: true/);
        expect(page).toMatch(/setPinned/);
        expect(page).toMatch(/createPortal/);
        expect(page).toMatch(/root: null/);
        expect(page).toMatch(/fixed inset-x-0/);
        expect(page).toMatch(/aria-current=\{isCurrent \? "true"/);
        expect(page).toMatch(/variant=\{isCurrent \? "default" : "outline"\}/);
        expect(live).toMatch(/\{sprint\.name\}/);
        expect(live).toMatch(/id=\{headingId\}/);
        expect(live).toMatch(/tabIndex=\{-1\}/);
    });
});
