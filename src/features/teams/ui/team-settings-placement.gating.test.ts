import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../.."
);

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Team settings placement seam", () => {
    it("Team settings route renders Members/Invites for a teamId", () => {
        const route = read("src/routes/(main)/teams/$teamId/settings.tsx");
        expect(route).toMatch(/TeamMembersSettings/);
        expect(route).toMatch(/teamId/);
        expect(route).not.toMatch(/ProjectMembersSettings/);
    });

    it("Team settings route includes danger-zone delete for owners", () => {
        const route = read("src/routes/(main)/teams/$teamId/settings.tsx");
        expect(route).toMatch(/TeamDangerZone/);
    });

    it("Team settings route includes name edit for owners", () => {
        const route = read("src/routes/(main)/teams/$teamId/settings.tsx");
        expect(route).toMatch(/TeamNameSettings/);
    });

    it("Project settings no longer owns Members/Invites UI", () => {
        const route = read(
            "src/routes/(main)/projects/$projectId/settings.tsx"
        );
        expect(route).not.toMatch(/ProjectMembersSettings/);
        expect(route).not.toMatch(/activeSection === "members"/);
        expect(route).toMatch(/\/teams\/\$teamId\/settings/);
    });
});
