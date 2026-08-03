import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("useProjectAccess Team wrap seam", () => {
    it("thin-wraps onto useTeamAccess via Project team_id", () => {
        const source = readFileSync(
            path.join(dirname, "use-project-access.ts"),
            "utf8"
        );

        expect(source).toMatch(/useTeamAccess/);
        expect(source).toMatch(/team_id/);
        expect(source).not.toMatch(/fetchMyProjectMembership/);
        expect(source).not.toMatch(/projectKeys\.myMembership/);
    });
});
