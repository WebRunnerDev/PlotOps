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

describe("boards.is_development seam", () => {
    it("adds Development Board flag, backfills, and clears git mapping when off", () => {
        const sql = latestMigrationMatching("boards_is_development");

        expect(sql).toMatch(/add column[\s\S]*is_development/i);
        expect(sql).toMatch(
            /set is_development = true[\s\S]*base_branch is not null/i
        );
        expect(sql).toMatch(/boards_development_git_mapping/);
        expect(sql).toMatch(/p_is_development/);
        expect(sql).toMatch(/Development Board requires a Base branch/i);
    });
});
