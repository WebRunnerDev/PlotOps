import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TeamsPage query error gating", () => {
    it("shows the teams/projects error only for a settled query failure", () => {
        const source = fs.readFileSync(
            path.join(dirname, "teams-page.tsx"),
            "utf8"
        );

        // `error` alone is not enough if we ever surface mid-retry; require
        // isError and keep the alert out of the loading path.
        expect(source).toMatch(/isError:\s*teamsError/);
        expect(source).toMatch(/isError:\s*projectsError/);
        expect(source).toMatch(/isError\s*&&\s*!isLoading/);
        expect(source).not.toMatch(/\{error\s*&&/);
    });
});
