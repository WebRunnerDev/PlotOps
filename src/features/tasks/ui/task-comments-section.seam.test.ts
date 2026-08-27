import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
    path.join(dirname, "task-comments-section.tsx"),
    "utf8"
);

describe("task comments section seam", () => {
    it("uses YouTube/Jira row layout: avatar + min-w-0 content column", () => {
        expect(source).toMatch(/data-task-comments/);
        expect(source).toMatch(/data-comment-composer/);
        expect(source).toMatch(/min-w-0 flex-1/);
        expect(source).toMatch(/formatDistanceToNow/);
        expect(source).toMatch(/onModEnter/);
    });

    it("keeps reply indent on a single rail so nested replies do not shrink width", () => {
        expect(source).toMatch(/data-comment-replies/);
        expect(source).toMatch(/border-l border-border pl-3 sm:pl-4/);
        // Indent must live on CommentReplies once — not recursive pl-* on each item.
        expect(source).toMatch(/export function CommentReplies/);
        expect(source).toMatch(/replies\?: ReactNode/);
        expect(source).toMatch(/buildCommentThreads/);
        expect(source).toMatch(/resolveReplyParentId/);
        expect(source).toMatch(/data-comment-reply-composer/);
        expect(source).toMatch(/comments\.reply/);
        // Anti-shrink: no recursive ml-/pl- on reply items beyond CommentReplies.
        expect(source).not.toMatch(/isReply[\s\S]{0,200}pl-\d/);
    });
});
