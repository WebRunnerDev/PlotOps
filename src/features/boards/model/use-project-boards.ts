import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { BoardDefaultTaskType } from "@/features/boards/model/types";

import { resolveBoardsProvider } from "@/features/boards/api/resolve-boards-provider";
import { invalidateProjectBoards } from "@/features/boards/model/invalidate-boards";
import { boardKeys } from "@/features/boards/model/query-keys";
import { isGuest } from "@/features/guest-mode";

export function useBoardMutations(projectId: string) {
    const queryClient = useQueryClient();
    const boardsProvider = resolveBoardsProvider(isGuest());

    const invalidate = () => {
        invalidateProjectBoards(queryClient, projectId);
    };

    const createMutation = useMutation({
        mutationFn: ({
            baseBranch,
            name,
        }: {
            baseBranch: string;
            name: string;
        }) => boardsProvider.createBoard(projectId, name, baseBranch),
        onError: () => {
            toast.error("Could not create board");
        },
        onSuccess: () => {
            invalidate();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({
            boardId,
            patch,
        }: {
            boardId: string;
            patch: {
                allowed_head_patterns?: string[];
                base_branch?: string;
                default_task_type?: BoardDefaultTaskType;
                name?: string;
            };
        }) => boardsProvider.updateBoard(boardId, patch),
        onError: () => {
            toast.error("Could not update board");
        },
        onSuccess: () => {
            invalidate();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (boardId: string) => boardsProvider.deleteBoard(boardId),
        onSuccess: () => {
            invalidate();
        },
    });

    return {
        createBoard: (name: string, baseBranch: string) =>
            createMutation.mutateAsync({ baseBranch, name }),
        deleteBoard: (boardId: string) => deleteMutation.mutateAsync(boardId),
        isCreating: createMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isUpdating: updateMutation.isPending,
        updateBoard: (
            boardId: string,
            patch: {
                allowed_head_patterns?: string[];
                base_branch?: string;
                default_task_type?: BoardDefaultTaskType;
                name?: string;
            }
        ) => updateMutation.mutateAsync({ boardId, patch }),
    };
}

export function useProjectBoards(projectId: string) {
    const provider = resolveBoardsProvider(isGuest());

    return useQuery({
        enabled: Boolean(projectId),
        queryFn: () => provider.fetchProjectBoards(projectId),
        queryKey: boardKeys.list(projectId),
    });
}
