import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Comment create Watch enroll seam", () => {
    const migration = readFileSync(
        path.join(
            dirname,
            "../../../../supabase/migrations/20260908071656_comment-create-auto-enroll-watcher.sql"
        ),
        "utf8"
    );

    const commentsHook = readFileSync(
        path.join(dirname, "../../tasks/model/use-task-comments.ts"),
        "utf8"
    );

    const guestComments = readFileSync(
        path.join(dirname, "../../tasks/api/guest-task-comments.ts"),
        "utf8"
    );

    it("DB trigger enrolls author on Comment insert only", () => {
        expect(migration).toMatch(/task_watchers_on_comment_insert/);
        expect(migration).toMatch(/after insert on public\.task_comments/);
        expect(migration).not.toMatch(/after update on public\.task_comments/);
        expect(migration).toMatch(/on conflict do nothing/);
    });

    it("Comment create invalidates Watchers; edit does not enroll", () => {
        const createFunction = commentsHook.match(
            /export function useCreateTaskComment[\s\S]*?^export function /m
        )?.[0];
        const updateFunction = commentsHook.match(
            /export function useUpdateTaskComment[\s\S]*$/
        )?.[0];

        expect(createFunction).toBeDefined();
        expect(createFunction).toMatch(/taskWatchers|notificationsKeys/);
        expect(updateFunction).toBeDefined();
        expect(updateFunction).not.toMatch(
            /applyCommentWatchEnrollment|applyGuestCommentWatchEnrollment/
        );
    });

    it("Guest Comment create applies enroll; update does not", () => {
        expect(guestComments).toMatch(/applyGuestCommentWatchEnrollment/);
        expect(guestComments).toMatch(
            /createGuestTaskComment[\s\S]*applyGuestCommentWatchEnrollment/
        );
        const updateFunction = guestComments.match(
            /export function updateGuestTaskComment[\s\S]*$/
        )?.[0];
        expect(updateFunction).toBeDefined();
        expect(updateFunction).not.toMatch(/applyGuestCommentWatchEnrollment/);
    });
});
