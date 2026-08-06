import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("deleteTeam RLS seam", () => {
    it("selects deleted id and fails when no row returns", () => {
        const source = readFileSync(path.join(dirname, "teams-api.ts"), "utf8");
        const function_ = source.slice(
            source.indexOf("export async function deleteTeam"),
            source.indexOf("export async function fetchTeams")
        );

        expect(function_).toMatch(/\.delete\(\)/);
        expect(function_).toMatch(/\.select\(\s*["']id["']\s*\)/);
        expect(function_).toMatch(/\.maybeSingle\(\)/);
        expect(function_).toMatch(/if\s*\(\s*!data\s*\)/);
    });
});
