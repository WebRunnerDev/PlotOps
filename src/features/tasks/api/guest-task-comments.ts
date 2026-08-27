import type { TaskComment } from "@/features/tasks/model/types";

import {
    getGuestDisplayIdentity,
    getGuestSandbox,
    GUEST_SEED_ACTOR_ID,
    updateGuestSandbox,
} from "@/features/guest-mode";

export function createGuestTaskComment(input: {
    body: string;
    parentId?: null | string;
    projectId: string;
    taskId: string;
}): TaskComment {
    const now = new Date().toISOString();
    const comment = {
        author: guestAuthor(),
        body: input.body,
        createdAt: now,
        id: crypto.randomUUID(),
        parentId: input.parentId ?? null,
        projectId: input.projectId,
        taskId: input.taskId,
        updatedAt: now,
    };

    updateGuestSandbox((sandbox) => {
        sandbox.comments.push(comment);
    });

    return mapComment(comment);
}

export function deleteGuestTaskComment(commentId: string): void {
    updateGuestSandbox((sandbox) => {
        // Mirror ON DELETE CASCADE: removing a root drops its replies.
        sandbox.comments = sandbox.comments.filter(
            (comment) =>
                comment.id !== commentId && comment.parentId !== commentId
        );
    });
}

/** Static + local Comments from the Guest sandbox — no Supabase. */
export function fetchGuestTaskComments(taskId: string): TaskComment[] {
    const sandbox = getGuestSandbox();
    if (!sandbox) {
        return [];
    }

    return sandbox.comments
        .filter((comment) => comment.taskId === taskId)
        .map((comment) => mapComment(comment))
        .toSorted(
            (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
        );
}

export function updateGuestTaskComment(
    commentId: string,
    body: string
): TaskComment {
    let updated: null | ReturnType<typeof mapComment> = null;

    updateGuestSandbox((sandbox) => {
        const row = sandbox.comments.find(
            (comment) => comment.id === commentId
        );
        if (!row) {
            throw new Error("Comment not found");
        }
        row.body = body;
        row.updatedAt = new Date().toISOString();
        updated = mapComment(row);
    });

    if (!updated) {
        throw new Error("Comment not found");
    }
    return updated;
}

function guestAuthor(): TaskComment["author"] {
    const identity = getGuestDisplayIdentity();
    const name = identity
        ? `${identity.firstName} ${identity.lastName}`.trim()
        : "Demo Guest";

    return {
        id: GUEST_SEED_ACTOR_ID,
        name: name || "Demo Guest",
    };
}

function mapComment(row: {
    author?: { avatarUrl?: string; id: string; name: string };
    body: string;
    createdAt: string;
    id: string;
    parentId?: null | string;
    taskId: string;
    updatedAt: string;
}): TaskComment {
    return {
        author: row.author
            ? {
                  avatarUrl: row.author.avatarUrl,
                  id: row.author.id,
                  name: row.author.name,
              }
            : undefined,
        body: row.body,
        createdAt: row.createdAt,
        id: row.id,
        parentId: row.parentId ?? null,
        taskId: row.taskId,
        updatedAt: row.updatedAt,
    };
}
