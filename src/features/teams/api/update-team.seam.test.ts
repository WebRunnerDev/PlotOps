import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("updateTeam RLS seam", () => {
    it("updates name and selects the mapped row", () => {
        const source = readFileSync(path.join(dirname, "teams-api.ts"), "utf8");
        // Slice up to the next export (or EOF) so module order does not matter.
        const start = source.indexOf("export async function updateTeam");
        const next = source.indexOf("\nexport ", start + 1);
        const function_ = source.slice(start, next === -1 ? undefined : next);

        expect(function_).toMatch(
            /\.update\(\s*\{\s*name:\s*trimmed\s*\}\s*\)/
        );
        expect(function_).toMatch(/\.select\(TEAM_SELECT\)/);
        expect(function_).toMatch(/\.single\(\)/);
    });
});
