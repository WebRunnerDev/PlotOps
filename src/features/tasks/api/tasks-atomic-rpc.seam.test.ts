import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readApi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("tasks API atomic label replace seam", () => {
    it("replaces labels via single replace_task_labels RPC", () => {
        const source = readApi("tasks-api.ts");

        expect(source).toMatch(/rpc\(\s*["']replace_task_labels["']/);
        expect(source).not.toMatch(
            /from\(["']task_labels["']\)[\s\S]*\.delete\(/
        );
    });
});

describe("tasks API atomic persist moves seam", () => {
    it("persists column moves via single persist_task_moves RPC", () => {
        const source = readApi("tasks-api.ts");

        expect(source).toMatch(/rpc\(\s*["']persist_task_moves["']/);
        expect(source).not.toMatch(
            /Promise\.all\(\s*updates\.map\(\s*\(item\)\s*=>\s*supabase[\s\S]*\.from\(\s*["']tasks["']\s*\)/
        );
    });
});

describe("tasks API atomic details + labels seam", () => {
    it("updates task details and labels via single update_task_details RPC", () => {
        const source = readApi("tasks-api.ts");

        expect(source).toMatch(/rpc\(\s*["']update_task_details["']/);
        expect(source).not.toMatch(
            /await updateTaskRecord\([\s\S]*replaceTaskLabels/
        );
    });
});

describe("tasks API Subtask hierarchy RPC seam", () => {
    it("creates a Subtask and clears Parent via RPCs, not ad-hoc parent_id patches", () => {
        const source = readApi("tasks-api.ts");

        expect(source).toMatch(/rpc\(\s*["']create_subtask["']/);
        expect(source).toMatch(/rpc\(\s*["']clear_task_parent["']/);
        expect(source).not.toMatch(/\.insert\([\s\S]{0,200}parent_id:/);
    });
});

describe("tasks API Task Link relates to RPC seam", () => {
    it("creates and deletes Task Links via RPCs, not ad-hoc task_links patches", () => {
        const source = readApi("tasks-api.ts");
        const migration = readFileSync(
            path.join(
                dirname,
                "../../../../supabase/migrations/20260814070853_task_links_relates_to.sql"
            ),
            "utf8"
        );
        const blocksMigration = readFileSync(
            path.join(
                dirname,
                "../../../../supabase/migrations/20260814094923_task_links_blocks.sql"
            ),
            "utf8"
        );

        expect(source).toMatch(/rpc\(\s*["']create_task_link["']/);
        expect(source).toMatch(/rpc\(\s*["']delete_task_link["']/);
        expect(source).not.toMatch(
            /from\(["']task_links["']\)[\s\S]*\.insert\(/
        );
        expect(source).not.toMatch(
            /from\(["']task_links["']\)[\s\S]*\.delete\(/
        );
        expect(migration).toMatch(
            /create table if not exists public\.task_links/
        );
        expect(migration).toMatch(/can_view_project/);
        expect(migration).toMatch(/can_edit_tasks/);
        expect(migration).toMatch("A Task cannot relate to itself");
        expect(migration).toMatch(
            "A Task Link cannot connect a Parent Task and its own Subtask"
        );
        expect(migration).toMatch(
            "Task Links must stay inside the same Project"
        );
        expect(migration).not.toMatch(/create_task_notifications/);
        expect(migration).not.toMatch(/create_notifications_for_watchers/);
        expect(blocksMigration).toMatch("A cyclic blocks chain is not allowed");
        expect(blocksMigration).toMatch(
            "A Task cannot enter Done while an open blocker exists"
        );
        expect(blocksMigration).toMatch(/assert_task_may_enter_done/);
        expect(blocksMigration).not.toMatch(/create_task_notifications/);
    });
});

describe("tasks API Parent Task lifecycle RPC seam", () => {
    it("extends persist_task_moves, archive, and delete with Parent Task gates", () => {
        const source = readApi("tasks-api.ts");
        const migration = readFileSync(
            path.join(
                dirname,
                "../../../../supabase/migrations/20260813125841_parent_task_lifecycle_gates.sql"
            ),
            "utf8"
        );

        expect(source).toMatch(/rpc\(\s*["']persist_task_moves["']/);
        expect(source).toMatch(/rpc\(\s*["']archive_tasks["']/);
        expect(migration).toMatch(/assert_parent_task_may_enter_done/);
        expect(migration).toMatch(/assert_parent_task_may_archive/);
        expect(migration).toMatch(/assert_parent_task_may_delete/);
        expect(migration).toMatch(
            "A Parent Task cannot enter Done while Subtasks are not Done"
        );
        expect(migration).toMatch(
            "A Parent Task cannot be archived while Subtasks are still active"
        );
        expect(migration).toMatch(
            "A Parent Task cannot be deleted while Subtasks exist"
        );
    });
});
