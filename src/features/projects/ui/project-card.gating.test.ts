import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("ProjectCard delete gating seam", () => {
    it("gates remove control on Team-backed canDeleteProject", () => {
        const card = readUi("project-card.tsx");

        expect(card).toMatch(/useProjectAccess/);
        expect(card).toMatch(/canDeleteProject/);
        expect(card).toMatch(/isSettled/);
        expect(card).toMatch(/canDelete\s*\?|canDelete\s*&&|\{canDelete\b/);
    });
});
