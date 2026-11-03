import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("createProject under Team seam", () => {
    it("creates the Project and its Repositories in one RPC under input.team_id", () => {
        const source = readFileSync(
            path.join(dirname, "projects-api.ts"),
            "utf8"
        );
        const start = source.indexOf("export async function createProject");
        const nextExport = source.indexOf("export async function", start + 1);
        const function_ = source.slice(
            start,
            nextExport === -1 ? undefined : nextExport
        );

        expect(function_).toMatch(
            /\.rpc\(\s*["']create_project_with_repositories["']/
        );
        expect(function_).toMatch(/p_team_id:\s*input\.team_id/);
        expect(function_).toMatch(/p_repositories:\s*input\.repositories/);
        expect(function_).not.toMatch(/\.from\(\s*["']teams["']\s*\)/);
    });
});
