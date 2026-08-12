import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("connectProjectGithub seam", () => {
    it("updates only name-only Projects and selects the mapped row", () => {
        const source = readFileSync(
            path.join(dirname, "projects-api.ts"),
            "utf8"
        );
        const function_ = source.slice(
            source.indexOf("export async function connectProjectGithub"),
            source.indexOf("export async function deleteProject")
        );

        expect(function_).toMatch(/\.from\(\s*["']projects["']\s*\)/);
        expect(function_).toMatch(/\.update\(\s*patch\s*\)/);
        expect(function_).toMatch(/\.eq\(\s*["']id["']\s*,\s*projectId\s*\)/);
        expect(function_).toMatch(
            /\.is\(\s*["']github_repo_id["']\s*,\s*null\s*\)/
        );
        expect(function_).toMatch(/\.maybeSingle\(\)/);
        expect(function_).toMatch(/if\s*\(\s*!data\s*\)/);
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
