import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("teams_select_member INSERT…RETURNING seam", () => {
    it("SELECT policy allows owner_id = auth.uid() without re-query", () => {
        const sql = readFileSync(
            path.resolve(
                process.cwd(),
                "supabase/migrations/20260803152005_teams_select_owner_direct_for_insert_returning.sql"
            ),
            "utf8"
        );

        expect(sql).toMatch(/owner_id\s*=\s*\(select auth\.uid\(\)\)/i);
        expect(sql).toMatch(/teams_select_member/);
    });
});
