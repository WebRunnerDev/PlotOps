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

describe("Project settings Team Role gating seam", () => {
    it("gates Board/Labels settings on Team-backed Project access caps", () => {
        const route = read(
            "src/routes/(main)/projects/$projectId/settings.tsx"
        );

        expect(route).toMatch(/useProjectAccess/);
        expect(route).toMatch(/canManageBoard/);
        expect(route).toMatch(/canManageSettings/);
        expect(route).toMatch(/isSettled/);
        expect(route).not.toMatch(/fetchMyProjectMembership/);
        expect(route).not.toMatch(/project_members/);
    });

    it("Team settings gates Members on useTeamAccess", () => {
        const route = read("src/routes/(main)/teams/$teamId/settings.tsx");

        expect(route).toMatch(/useTeamAccess/);
        expect(route).toMatch(/canManageMembers/);
        expect(route).not.toMatch(/useProjectAccess/);
    });
});
