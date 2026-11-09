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
    it("adds a Repository with its own visibility and leaves the Project's to Postgres (#360)", () => {
        const function_ = slice(
            read("projects-api.ts"),
            "export async function addProjectRepository",
            "export async function countRepositoryGitLinks"
        );

        expect(function_).toMatch(
            /\.from\(\s*["']project_repositories["']\s*\)\s*\.insert\(/
        );
        expect(function_).toMatch(/\.\.\.patch/);
        expect(function_).toMatch(/project_id:\s*projectId/);
        // `project_repositories_sync_project_privacy` owns projects.is_private.
        expect(function_).not.toMatch(/\.from\(\s*["']projects["']\s*\)/);
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
        // Several Git links per Task (ADR 0036): count distinct Tasks.
        expect(count).toMatch(/new Set\(/);
        expect(count).toMatch(/\.eq\(\s*["']repository_id["']/);
    });

    it("reads each Repository's visibility back with the Project", () => {
        const source = read("projects-api.ts");
        const select = slice(
            source,
            "const PROJECT_SELECT",
            "export async function addProjectRepository"
        );

        expect(select).toMatch(
            /repositories:project_repositories[^)]*is_private/
        );
        expect(source).toMatch(/is_private:\s*repo\.is_private/);
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
