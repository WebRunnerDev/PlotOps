import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(
    dirname,
    "../../../../supabase/migrations"
);

function latestMigrationMatching(fragment: string): string {
    const files = readdirSync(migrationsDirectory)
        .filter((name) => name.includes(fragment) && name.endsWith(".sql"))
        .toSorted();
    const latest = files.at(-1);
    if (!latest) {
        throw new Error(`No migration matching ${fragment}`);
    }
    return readFileSync(path.join(migrationsDirectory, latest), "utf8");
}

describe("boards.base_branch nullable seam", () => {
    it("allows empty base branch (null) for Boards that are not for development", () => {
        const sql = latestMigrationMatching("boards_base_branch_nullable");

        expect(sql).toMatch(
            /alter\s+table\s+public\.boards[\s\S]*alter\s+column\s+base_branch\s+drop\s+not\s+null/i
        );
        expect(sql).toMatch(
            /create\s+or\s+replace\s+function\s+public\.create_board_with_columns/i
        );
        expect(sql).toMatch(
            /branch_name\s*:=\s*nullif\s*\(\s*btrim\s*\(\s*coalesce\s*\(\s*p_base_branch/i
        );
        // Empty input must stay null — do not coerce to 'main'.
        expect(sql).not.toMatch(
            /if\s+branch_name\s+is\s+null\s+then\s+branch_name\s*:=\s*'main'/i
        );
    });
});
