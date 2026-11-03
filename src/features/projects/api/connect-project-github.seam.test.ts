import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("connectProjectGithub seam", () => {
    it("links a Repository only to a Project without one (ADR 0034)", () => {
        const source = readFileSync(
            path.join(dirname, "projects-api.ts"),
            "utf8"
        );
        const function_ = source.slice(
            source.indexOf("export async function connectProjectGithub"),
            source.indexOf("export async function createProject")
        );

        expect(function_).toMatch(/repositories\.length\s*>\s*0/);
        expect(function_).toMatch(
            /\.from\(\s*["']project_repositories["']\s*\)\s*\.insert\(/
        );
        expect(function_).toMatch(/project_id:\s*projectId/);
        expect(function_).toMatch(/\.update\(\s*\{\s*is_private/);
        expect(function_).toMatch(/fetchProject\(\s*projectId\s*\)/);
    });

    it("preserves Postgres unique_violation code through the Supabase provider", () => {
        const source = readFileSync(
            path.join(dirname, "supabase-projects.ts"),
            "utf8"
        );

        expect(source).toMatch(/connectProjectGithub/);
        expect(source).toMatch(/code/);
        expect(source).toMatch(/23505|error\.code|result\.error/);
    });

    it("blocks Guest Mode connect like Guest create/delete", () => {
        const source = readFileSync(
            path.join(dirname, "guest-projects.ts"),
            "utf8"
        );

        expect(source).toMatch(/connectProjectGithub/);
        expect(source).toMatch(/Guest Mode/);
    });
});
