import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Top bar narrow viewport seam", () => {
    it("stacks section nav and collapses breadcrumb on small screens", () => {
        const topBar = readUi("top-bar.tsx");
        const nav = readUi("project-section-nav.tsx");

        expect(topBar).toMatch(/overflow-x-auto/);
        expect(topBar).toMatch(/overflow-y-hidden/);
        expect(topBar).toMatch(/max-sm:hidden|sm:inline|sm:hidden/);
        expect(topBar).toMatch(/sm:grid-cols-3/);
        expect(nav).toMatch(/focus-visible:ring-inset/);
        expect(nav).toMatch(/labelShort|nav\.\w+Short/);
        expect(nav).toMatch(/xl:hidden/);
        expect(nav).toMatch(/xl:inline/);
    });

    it("breadcrumb uses Team name linking to the Team projects page", () => {
        const topBar = readUi("top-bar.tsx");
        expect(topBar).toMatch(/\/teams\/\$teamId/);
        expect(topBar).toMatch(/team\.name/);
        expect(topBar).not.toMatch(/nav\.projects/);
    });

    it("shows Demo account badge for guest sessions", () => {
        const topBar = readUi("top-bar.tsx");
        expect(topBar).toMatch(/demoAccountBadgeVisible/);
        expect(topBar).toMatch(/isGuestSession/);
        expect(topBar).toMatch(
            /DEMO_ACCOUNT_BADGE_I18N_KEY|guest\.demoAccount/
        );
    });
});
