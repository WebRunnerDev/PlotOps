import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const NEW_WATCHER_KINDS = [
    "comment",
    "title_change",
    "description_change",
    "labels_change",
    "estimate_change",
    "sprint_change",
] as const;

describe("widen Jira-like Notification kinds seam", () => {
    const migration = readFileSync(
        path.join(
            dirname,
            "../../../../supabase/migrations/20260907122938_widen_jira_like_notification_kinds.sql"
        ),
        "utf8"
    );

    it("includes the six new kinds in notifications.kind check", () => {
        expect(migration).toMatch(/notifications_kind_check/);
        for (const kind of NEW_WATCHER_KINDS) {
            expect(migration).toContain(`'${kind}'`);
        }
    });

    it("adds the six new kinds to notification_watcher_kinds for create_task_notifications", () => {
        expect(migration).toMatch(/notification_watcher_kinds/);
        const watcherKindsBlock = migration.match(
            /create or replace function public\.notification_watcher_kinds\(\)[\s\S]*?\$\$;/
        )?.[0];
        expect(watcherKindsBlock).toBeDefined();
        for (const kind of NEW_WATCHER_KINDS) {
            expect(watcherKindsBlock).toContain(`'${kind}'`);
        }
    });
});
