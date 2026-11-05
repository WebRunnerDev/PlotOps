import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function read(file: string) {
    return readFileSync(path.join(dirname, file), "utf8");
}

function slice(source: string, from: string, to: string) {
    return source.slice(source.indexOf(from), source.indexOf(to));
}

describe("Project Repositories seam (ADR 0035)", () => {
    it("adds a Repository to any Project and sets visibility only for the first", () => {
        const function_ = slice(
            read("projects-api.ts"),
            "export async function addProjectRepository",
            "export async function countRepositoryGitLinks"
        );

        expect(function_).toMatch(
            /\.from\(\s*["']project_repositories["']\s*\)\s*\.insert\(/
        );
        expect(function_).toMatch(/project_id:\s*projectId/);
        expect(function_).toMatch(/repositories\.length\s*===\s*0/);
        expect(function_).toMatch(/\.update\(\s*\{\s*is_private/);
        expect(function_).toMatch(/fetchProject\(\s*projectId\s*\)/);
    });

    it("unlinks by deleting the project_repositories row and counts Git links first", () => {
        const source = read("projects-api.ts");
        const remove = slice(
            source,
            "export async function removeProjectRepository",
            "export function slugifyRepoName"
        );
        const count = slice(
            source,
            "export async function countRepositoryGitLinks",
            "export async function createProject"
        );

        expect(remove).toMatch(
            /\.from\(\s*["']project_repositories["']\s*\)\s*\.delete\(\)/
        );
        expect(count).toMatch(/\.from\(\s*["']task_git_links["']\s*\)/);
        expect(count).toMatch(/count:\s*["']exact["']/);
        expect(count).toMatch(/\.eq\(\s*["']repository_id["']/);
    });

    it("preserves Postgres code and cap hint through the Supabase provider", () => {
        const source = read("supabase-projects.ts");

        expect(source).toMatch(/addProjectRepository/);
        expect(source).toMatch(/removeProjectRepository/);
        expect(source).toMatch(/wrapped\.code\s*=\s*error\.code/);
        expect(source).toMatch(/wrapped\.hint\s*=\s*error\.hint/);
    });

    it("blocks Guest Mode link and unlink like Guest create/delete", () => {
        const source = read("guest-projects.ts");

        expect(source).toMatch(/addProjectRepository/);
        expect(source).toMatch(/removeProjectRepository/);
        expect(source).toMatch(/not available in Guest Mode/);
    });
});
