import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
    BoardDefaultTaskType,
    CreateBoardInput,
} from "@/features/boards/model/types";

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
            input,
            name,
        }: {
            input: CreateBoardInput;
            name: string;
        }) => boardsProvider.createBoard(projectId, name, input),
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
                auto_assign_to_creator?: boolean;
                base_branch?: null | string;
                default_task_type?: BoardDefaultTaskType;
                is_development?: boolean;
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
        createBoard: (name: string, input: CreateBoardInput) =>
            createMutation.mutateAsync({ input, name }),
        deleteBoard: (boardId: string) => deleteMutation.mutateAsync(boardId),
        isCreating: createMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isUpdating: updateMutation.isPending,
        updateBoard: (
            boardId: string,
            patch: {
                allowed_head_patterns?: string[];
                auto_assign_to_creator?: boolean;
                base_branch?: null | string;
                default_task_type?: BoardDefaultTaskType;
                is_development?: boolean;
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
