import type { TaskComment } from "@/features/tasks/model/types";

export type TaskCommentThread = {
    replies: TaskComment[];
    root: TaskComment;
};

/**
 * Flat comments → one-level threads (YouTube / Jira).
 * Roots: parentId null/undefined. Orphans (missing parent) treated as roots.
 * Children sorted by createdAt asc. Nested parentIds (reply-of-reply) still
 * attach under their parent when that parent is a root; deeper nesting is
 * flattened by resolveReplyParentId on create.
 */
export function buildCommentThreads(
    comments: readonly TaskComment[]
): TaskCommentThread[] {
    const byId = new Map(comments.map((comment) => [comment.id, comment]));
    const children = new Map<string, TaskComment[]>();
    const roots: TaskComment[] = [];

    for (const comment of comments) {
        const parentId = comment.parentId;
        if (!parentId || !byId.has(parentId)) {
            roots.push(comment);
            continue;
        }
        const list = children.get(parentId) ?? [];
        list.push(comment);
        children.set(parentId, list);
    }

    const sortAsc = (a: TaskComment, b: TaskComment) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    roots.sort(sortAsc);

    return roots.map((root) => ({
        replies: (children.get(root.id) ?? []).toSorted(sortAsc),
        root,
    }));
}

/**
 * Reply always hangs on the thread root. Answering a reply uses the root id.
 */
export function resolveReplyParentId(
    comments: readonly TaskComment[],
    replyToId: string
): string {
    const byId = new Map(comments.map((comment) => [comment.id, comment]));
    let current = byId.get(replyToId);
    if (!current) {
        return replyToId;
    }
    while (current.parentId) {
        const parent = byId.get(current.parentId);
        if (!parent) {
            return current.parentId;
        }
        current = parent;
    }
    return current.id;
}
