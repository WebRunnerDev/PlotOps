import type { TaskComment } from "@/features/tasks/model/types";

import { formatProfileDisplayName } from "@/features/auth/lib/user-display";
import { supabase } from "@/shared/api/supabase";

type DatabaseProfile = {
    avatar_url: null | string;
    first_name: null | string;
    id: string;
    last_name: null | string;
    username: null | string;
};

type DatabaseTaskComment = {
    author: DatabaseProfile | DatabaseProfile[] | null;
    author_id: null | string;
    body: string;
    created_at: string;
    id: string;
    project_id: string;
    task_id: string;
    updated_at: string;
};

const COMMENT_SELECT = `
  id,
  task_id,
  project_id,
  author_id,
  body,
  created_at,
  updated_at,
  author:profiles!task_comments_author_id_fkey (
    id,
    username,
    avatar_url,
    first_name,
    last_name
  )
`;

export async function createTaskComment(input: {
    body: string;
    projectId: string;
    taskId: string;
}) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Not authenticated");
    }

    const result = await supabase
        .from("task_comments")
        .insert({
            author_id: user.id,
            body: input.body,
            project_id: input.projectId,
            task_id: input.taskId,
        })
        .select(COMMENT_SELECT)
        .single();

    return {
        ...result,
        data: result.data
            ? mapComment(result.data as DatabaseTaskComment)
            : null,
    };
}

export async function deleteTaskComment(commentId: string) {
    return supabase.from("task_comments").delete().eq("id", commentId);
}

export async function fetchTaskComments(taskId: string) {
    const result = await supabase
        .from("task_comments")
        .select(COMMENT_SELECT)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

    return {
        ...result,
        data: result.data?.map((row) => mapComment(row as DatabaseTaskComment)),
    };
}

export async function updateTaskComment(commentId: string, body: string) {
    const result = await supabase
        .from("task_comments")
        .update({ body })
        .eq("id", commentId)
        .select(COMMENT_SELECT)
        .single();

    return {
        ...result,
        data: result.data
            ? mapComment(result.data as DatabaseTaskComment)
            : null,
    };
}

function asProfile(
    value: DatabaseProfile | DatabaseProfile[] | null | undefined
): DatabaseProfile | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapComment(row: DatabaseTaskComment): TaskComment {
    const author = asProfile(row.author);
    const name = author ? formatProfileDisplayName(author) : "";

    return {
        author:
            author && name
                ? {
                      avatarUrl: author.avatar_url ?? undefined,
                      id: author.id,
                      name,
                  }
                : undefined,
        body: row.body,
        createdAt: row.created_at,
        id: row.id,
        taskId: row.task_id,
        updatedAt: row.updated_at,
    };
}
