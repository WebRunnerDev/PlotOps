import type { TaskComment } from "@/features/tasks/model/types";
import { supabase } from "@/shared/api/supabase";

type DbProfile = {
    avatar_url: string | null;
    id: string;
    username: string | null;
};

type DbTaskComment = {
    author: DbProfile | DbProfile[] | null;
    author_id: string | null;
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
    avatar_url
  )
`;

function asProfile(
    value: DbProfile | DbProfile[] | null | undefined,
): DbProfile | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapComment(row: DbTaskComment): TaskComment {
    const author = asProfile(row.author);

    return {
        author: author?.username
            ? {
                  avatarUrl: author.avatar_url ?? undefined,
                  id: author.id,
                  name: author.username,
              }
            : undefined,
        body: row.body,
        createdAt: row.created_at,
        id: row.id,
        taskId: row.task_id,
        updatedAt: row.updated_at,
    };
}

export async function fetchTaskComments(taskId: string) {
    const result = await supabase
        .from("task_comments")
        .select(COMMENT_SELECT)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

    return {
        ...result,
        data: result.data?.map((row) => mapComment(row as DbTaskComment)),
    };
}

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
        data: result.data ? mapComment(result.data as DbTaskComment) : null,
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
        data: result.data ? mapComment(result.data as DbTaskComment) : null,
    };
}

export async function deleteTaskComment(commentId: string) {
    return supabase.from("task_comments").delete().eq("id", commentId);
}
