import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("createProject under Team seam", () => {
    it("inserts into projects with input.team_id and does not create a Team", () => {
        const source = readFileSync(
            path.join(dirname, "projects-api.ts"),
            "utf8"
        );
        const function_ = source.slice(
            source.indexOf("export async function createProject"),
            source.indexOf("export async function deleteProject")
        );

        expect(function_).toMatch(/\.from\(\s*["']projects["']\s*\)/);
        expect(function_).toMatch(/\.insert\(\s*input\s*\)/);
        expect(function_).not.toMatch(/\.from\(\s*["']teams["']\s*\)/);
    });
});
