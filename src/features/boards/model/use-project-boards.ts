import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
    createBoard,
    deleteBoard,
    fetchProjectBoards,
    updateBoard,
} from "@/features/boards/api/boards-api";
import { invalidateProjectBoards } from "@/features/boards/model/invalidate-boards";
import { boardKeys } from "@/features/boards/model/query-keys";

export function useBoardMutations(projectId: string) {
    const queryClient = useQueryClient();

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
        }) => createBoard(projectId, name, baseBranch),
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
                name?: string;
            };
        }) => updateBoard(boardId, patch),
        onError: () => {
            toast.error("Could not update board");
        },
        onSuccess: () => {
            invalidate();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (boardId: string) => deleteBoard(boardId),
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
                name?: string;
            }
        ) => updateMutation.mutateAsync({ boardId, patch }),
    };
}

export function useProjectBoards(projectId: string) {
    return useQuery({
        enabled: Boolean(projectId),
        queryFn: () => fetchProjectBoards(projectId),
        queryKey: boardKeys.list(projectId),
    });
}
