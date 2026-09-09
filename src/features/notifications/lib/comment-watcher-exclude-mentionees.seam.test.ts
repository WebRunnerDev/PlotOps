import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("comment Watcher Mentionee exclude seam", () => {
    const migration = readFileSync(
        path.join(
            dirname,
            "../../../../supabase/migrations/20260907125745_comment_watcher_exclude_mentionees.sql"
        ),
        "utf8"
    );

    const api = readFileSync(
        path.join(dirname, "../api/notifications-api.ts"),
        "utf8"
    );

    it("create_task_notifications unions event exclude_recipient_ids into Watcher fan-out", () => {
        expect(migration).toMatch(/create_task_notifications/);
        expect(migration).toMatch(/exclude_recipient_ids/);
        expect(migration).toMatch(
            /exclude_ids := exclude_ids \|\| coalesce\(event_exclude_ids/
        );
    });

    it("createTaskNotifications maps excludeRecipientIds onto the RPC payload", () => {
        expect(api).toMatch(/excludeRecipientIds/);
        expect(api).toMatch(
            /exclude_recipient_ids:\s*event\.excludeRecipientIds/
        );
    });
});
