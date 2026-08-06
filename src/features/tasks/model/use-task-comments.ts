import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isGuest } from "@/features/guest-mode";
import { notifyNewMentionsBestEffort } from "@/features/notifications/lib/notify-new-mentions";
import {
    createGuestTaskComment,
    deleteGuestTaskComment,
    fetchGuestTaskComments,
    updateGuestTaskComment,
} from "@/features/tasks/api/guest-task-comments";
import {
    createTaskComment,
    deleteTaskComment,
    fetchTaskComments,
    updateTaskComment,
} from "@/features/tasks/api/task-comments-api";
import { taskKeys } from "@/features/tasks/model/query-keys";

export function useCreateTaskComment(taskId: string, projectId: string) {
    const queryClient = useQueryClient();
    const guest = isGuest();

    return useMutation({
        mutationFn: async (body: string) => {
            if (guest) {
                return createGuestTaskComment({ body, projectId, taskId });
            }

            const { data, error } = await createTaskComment({
                body,
                projectId,
                taskId,
            });
            if (error) throw error;
            if (!data) throw new Error("Comment create returned empty");

            await notifyNewMentionsBestEffort({
                commentId: data.id,
                nextBody: body,
                previousBody: "",
                source: "comment",
                taskId,
            });

            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: commentsKey(taskId),
            });
        },
    });
}

export function useDeleteTaskComment(taskId: string) {
    const queryClient = useQueryClient();
    const guest = isGuest();

    return useMutation({
        mutationFn: async (commentId: string) => {
            if (guest) {
                deleteGuestTaskComment(commentId);
                return;
            }
            const { error } = await deleteTaskComment(commentId);
            if (error) throw error;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: commentsKey(taskId),
            });
        },
    });
}

export function useTaskComments(taskId: string | undefined) {
    const guest = isGuest();

    return useQuery({
        enabled: Boolean(taskId),
        queryFn: async () => {
            if (guest) {
                return fetchGuestTaskComments(taskId!);
            }
            const { data, error } = await fetchTaskComments(taskId!);
            if (error) throw error;
            return data ?? [];
        },
        queryKey: commentsKey(taskId!),
    });
}

export function useUpdateTaskComment(taskId: string) {
    const queryClient = useQueryClient();
    const guest = isGuest();

    return useMutation({
        mutationFn: async (input: {
            body: string;
            commentId: string;
            previousBody: string;
        }) => {
            if (guest) {
                return updateGuestTaskComment(input.commentId, input.body);
            }

            const { data, error } = await updateTaskComment(
                input.commentId,
                input.body
            );
            if (error) throw error;
            if (!data) throw new Error("Comment update returned empty");

            await notifyNewMentionsBestEffort({
                commentId: input.commentId,
                nextBody: input.body,
                previousBody: input.previousBody,
                source: "comment",
                taskId,
            });

            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: commentsKey(taskId),
            });
        },
    });
}

function commentsKey(taskId: string) {
    return [...taskKeys.all, "comments", taskId] as const;
}
