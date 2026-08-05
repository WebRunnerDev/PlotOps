import type { RealtimeChannel } from "@supabase/supabase-js";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { BoardColumn } from "@/features/boards/model/types";

import {
    createBoardColumn,
    deleteBoardColumn,
    renameBoardColumn,
    reorderBoardColumns,
} from "@/features/boards/api/board-columns-api";
import { orderColumnsByIds } from "@/features/boards/api/board-mappers";
import { resolveBoardsProvider } from "@/features/boards/api/resolve-boards-provider";
import { invalidateBoardColumns } from "@/features/boards/model/invalidate-boards";
import { boardKeys } from "@/features/boards/model/query-keys";
import { isGuest } from "@/features/guest-mode";
import { supabase } from "@/shared/api/supabase";

/** Ref-count Realtime channels so multiple mounts share one `board_columns` subscription. */
const columnChannels = new Map<
    string,
    { channel: RealtimeChannel; subscribers: number }
>();

export function useBoardColumns(projectId: string, boardId: string) {
    const queryClient = useQueryClient();
    const dragGestureColumnsReference = useRef<BoardColumn[] | null>(null);
    const guest = isGuest();
    const boardsProvider = resolveBoardsProvider(guest);

    const columnsQuery = useQuery({
        enabled: Boolean(projectId && boardId),
        queryFn: () => boardsProvider.fetchBoardColumns(projectId, boardId),
        queryKey: boardKeys.columns(projectId, boardId),
    });

    useEffect(() => {
        if (!projectId || guest) return;

        return subscribeBoardColumnsChannel(projectId, () => {
            invalidateBoardColumns(queryClient, projectId);
        });
    }, [guest, projectId, queryClient]);

    const addColumnMutation = useMutation({
        mutationFn: (name: string) => {
            if (guest) {
                throw new Error(
                    "Adding columns is not available in Guest Mode"
                );
            }
            return createBoardColumn(projectId, boardId, name);
        },
        onError: () => {
            toast.error("Failed to add column");
        },
        onSuccess: () => {
            invalidateBoardColumns(queryClient, projectId);
        },
    });

    const renameColumnMutation = useMutation({
        mutationFn: ({
            columnId,
            name,
        }: {
            columnId: string;
            name: string;
        }) => {
            if (guest) {
                throw new Error(
                    "Renaming columns is not available in Guest Mode"
                );
            }
            return renameBoardColumn(boardId, columnId, name);
        },
        onError: () => {
            toast.error("Failed to rename column");
        },
        onSuccess: () => {
            invalidateBoardColumns(queryClient, projectId);
        },
    });

    const deleteColumnMutation = useMutation({
        mutationFn: ({
            columnId,
            moveTasksTo,
        }: {
            columnId: string;
            moveTasksTo?: string;
        }) => {
            if (guest) {
                throw new Error(
                    "Deleting columns is not available in Guest Mode"
                );
            }
            return deleteBoardColumn(boardId, columnId, moveTasksTo);
        },
        onError: () => {
            toast.error("Failed to delete column");
        },
        onSuccess: () => {
            invalidateBoardColumns(queryClient, projectId);
        },
    });

    const reorderColumnsMutation = useMutation({
        mutationFn: (columnIds: string[]) => {
            if (guest) {
                throw new Error(
                    "Reordering columns is not available in Guest Mode"
                );
            }
            return reorderBoardColumns(boardId, columnIds);
        },
        onError: () => {
            toast.error("Failed to reorder columns");
        },
        onSettled: () => {
            invalidateBoardColumns(queryClient, projectId);
        },
    });

    const columns = columnsQuery.data ?? [];

    const applyColumnOrder = (
        activeId: string,
        overId: string,
        persist: boolean
    ) => {
        const currentColumns =
            queryClient.getQueryData<BoardColumn[]>(
                boardKeys.columns(projectId, boardId)
            ) ?? columns;
        const oldIndex = currentColumns.findIndex(
            (column) => column.id === activeId
        );
        const newIndex = currentColumns.findIndex(
            (column) => column.id === overId
        );
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return;
        }

        if (!persist && !dragGestureColumnsReference.current) {
            dragGestureColumnsReference.current = currentColumns;
        }

        const next = [...currentColumns];
        const [moved] = next.splice(oldIndex, 1);
        if (!moved) return;
        next.splice(newIndex, 0, moved);

        const ordered = next.map((column) => column.id);
        queryClient.setQueryData<BoardColumn[]>(
            boardKeys.columns(projectId, boardId),
            (current) =>
                current
                    ? orderColumnsByIds(current, ordered)
                    : orderColumnsByIds(currentColumns, ordered)
        );

        if (!persist) return;

        const previous = dragGestureColumnsReference.current ?? currentColumns;
        reorderColumnsMutation.mutate(ordered, {
            onError: () => {
                queryClient.setQueryData(
                    boardKeys.columns(projectId, boardId),
                    previous
                );
            },
        });
        dragGestureColumnsReference.current = null;
    };

    return {
        addColumn: (name: string) => addColumnMutation.mutateAsync(name),
        columns,
        columnsError: columnsQuery.isError,
        /** True once columns have been fetched (including an empty list). */
        columnsReady: columnsQuery.data !== undefined,
        commitColumnDragGesture: () => {
            const previous = dragGestureColumnsReference.current;
            if (!previous) return;

            const current = queryClient.getQueryData<BoardColumn[]>(
                boardKeys.columns(projectId, boardId)
            );
            dragGestureColumnsReference.current = null;
            if (!current) return;

            const ordered = current.map((column) => column.id);
            const previousIds = previous.map((column) => column.id);
            if (ordered.join("\0") === previousIds.join("\0")) return;

            reorderColumnsMutation.mutate(ordered, {
                onError: () => {
                    queryClient.setQueryData(
                        boardKeys.columns(projectId, boardId),
                        previous
                    );
                },
            });
        },
        deleteColumn: async (columnId: string, moveTasksTo?: string) => {
            if (columns.length <= 1) return false;
            await deleteColumnMutation.mutateAsync({ columnId, moveTasksTo });
            return true;
        },
        error: columnsQuery.error ?? null,
        isLoading: columnsQuery.isLoading,
        renameColumn: async (columnId: string, name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return false;
            const duplicate = columns.some(
                (column) =>
                    column.id !== columnId &&
                    column.name.trim().toLowerCase() === trimmed.toLowerCase()
            );
            if (duplicate) return false;
            await renameColumnMutation.mutateAsync({
                columnId,
                name: trimmed,
            });
            return true;
        },
        reorderColumns: (
            activeId: string,
            overId: string,
            options?: { persist?: boolean }
        ) => {
            applyColumnOrder(activeId, overId, options?.persist ?? true);
        },
        rollbackColumnDragGesture: () => {
            const previous = dragGestureColumnsReference.current;
            dragGestureColumnsReference.current = null;
            if (!previous) return;
            queryClient.setQueryData(
                boardKeys.columns(projectId, boardId),
                previous
            );
        },
    };
}

function releaseBoardColumnsChannel(projectId: string) {
    const entry = columnChannels.get(projectId);
    if (!entry) return;
    entry.subscribers -= 1;
    if (entry.subscribers > 0) return;
    void supabase.removeChannel(entry.channel);
    columnChannels.delete(projectId);
}

function subscribeBoardColumnsChannel(
    projectId: string,
    onColumnsChange: () => void
): () => void {
    const existing = columnChannels.get(projectId);
    if (existing) {
        existing.subscribers += 1;
        return () => releaseBoardColumnsChannel(projectId);
    }

    const channel = supabase
        .channel(`board-columns:${projectId}:${crypto.randomUUID()}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                filter: `project_id=eq.${projectId}`,
                schema: "public",
                table: "board_columns",
            },
            onColumnsChange
        )
        .subscribe();

    columnChannels.set(projectId, { channel, subscribers: 1 });
    return () => releaseBoardColumnsChannel(projectId);
}
