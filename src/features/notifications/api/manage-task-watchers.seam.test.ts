import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Manage Watchers API seam", () => {
    it("add/remove Task Watch accept an optional target userId", () => {
        const source = readFileSync(
            path.join(dirname, "notifications-api.ts"),
            "utf8"
        );

        expect(source).toMatch(
            /export async function addTaskWatch\([\s\S]*userId\?:/
        );
        expect(source).toMatch(
            /export async function removeTaskWatch\([\s\S]*userId\?:/
        );
        expect(source).toMatch(/user_id:\s*input\.userId\s*\?\?\s*userId/);
    });
});

describe("Manage Watchers RLS seam", () => {
    const migration = readFileSync(
        path.join(
            dirname,
            "../../../../supabase/migrations/20260907124511_manage-task-watchers-by-role.sql"
        ),
        "utf8"
    );

    it("allows Contributor+ to insert/delete another Member's Watch", () => {
        expect(migration).toMatch(/can_manage_task_watcher/);
        expect(migration).toMatch(/can_edit_tasks\(p_project_id\)/);
        expect(migration).toMatch(
            /is_project_participant\(\s*p_project_id\s*,\s*p_target_user_id\s*\)/
        );
        expect(migration).toMatch(/task_watchers_insert/);
        expect(migration).toMatch(/task_watchers_delete/);
    });

    it("keeps self Watch for any viewer Role via auth.uid()", () => {
        expect(migration).toMatch(
            /p_target_user_id = \(select auth\.uid\(\)\)/
        );
        expect(migration).toMatch(/can_view_project\(p_project_id\)/);
    });
});
