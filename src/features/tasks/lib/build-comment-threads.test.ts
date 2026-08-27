import { describe, expect, it } from "vitest";

import type { TaskComment } from "@/features/tasks/model/types";

import {
    buildCommentThreads,
    resolveReplyParentId,
} from "./build-comment-threads";

function comment(
    id: string,
    createdAt: string,
    parentId?: null | string
): TaskComment {
    return {
        body: `<p>${id}</p>`,
        createdAt,
        id,
        parentId: parentId ?? null,
        taskId: "task-1",
        updatedAt: createdAt,
    };
}

describe("buildCommentThreads", () => {
    it("groups replies under roots and sorts by createdAt asc", () => {
        const threads = buildCommentThreads([
            comment("r1", "2026-08-01T10:00:00.000Z"),
            comment("c2", "2026-08-01T12:00:00.000Z", "r1"),
            comment("c1", "2026-08-01T11:00:00.000Z", "r1"),
            comment("r2", "2026-08-01T09:00:00.000Z"),
        ]);

        expect(threads.map((thread) => thread.root.id)).toEqual(["r2", "r1"]);
        expect(threads[1]!.replies.map((reply) => reply.id)).toEqual([
            "c1",
            "c2",
        ]);
    });

    it("treats orphan parentId as root so highlight still finds the row", () => {
        const threads = buildCommentThreads([
            comment("orphan", "2026-08-01T10:00:00.000Z", "missing"),
        ]);
        expect(threads).toHaveLength(1);
        expect(threads[0]!.root.id).toBe("orphan");
        expect(threads[0]!.replies).toEqual([]);
    });
});

describe("resolveReplyParentId", () => {
    it("returns the root when replying to a reply", () => {
        const comments = [
            comment("root", "2026-08-01T10:00:00.000Z"),
            comment("reply", "2026-08-01T11:00:00.000Z", "root"),
        ];
        expect(resolveReplyParentId(comments, "reply")).toBe("root");
        expect(resolveReplyParentId(comments, "root")).toBe("root");
    });
});
