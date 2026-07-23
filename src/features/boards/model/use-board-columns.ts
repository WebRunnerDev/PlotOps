import type { RealtimeChannel } from "@supabase/supabase-js";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import type { BoardColumn } from "@/features/boards/model/types";

import {
    createBoardColumn,
    deleteBoardColumn,
    fetchBoardColumns,
    renameBoardColumn,
    reorderBoardColumns,
} from "@/features/boards/api/board-columns-api";
import { orderColumnsByIds } from "@/features/boards/api/board-mappers";
import { invalidateBoardColumns } from "@/features/boards/model/invalidate-boards";
import { boardKeys } from "@/features/boards/model/query-keys";
import { supabase } from "@/shared/api/supabase";

/** Ref-count Realtime channels so multiple mounts share one `board_columns` subscription. */
const columnChannels = new Map<
    string,
    { channel: RealtimeChannel; subscribers: number }
>();

export function useBoardColumns(projectId: string, boardId: string) {
    const queryClient = useQueryClient();

    const columnsQuery = useQuery({
        enabled: Boolean(projectId && boardId),
        queryFn: () => fetchBoardColumns(projectId, boardId),
        queryKey: boardKeys.columns(projectId, boardId),
    });

    useEffect(() => {
        if (!projectId) return;

        return subscribeBoardColumnsChannel(projectId, () => {
            invalidateBoardColumns(queryClient, projectId);
        });
    }, [projectId, queryClient]);

    const addColumnMutation = useMutation({
        mutationFn: (name: string) =>
            createBoardColumn(projectId, boardId, name),
        onSuccess: () => {
            invalidateBoardColumns(queryClient, projectId);
        },
    });

    const renameColumnMutation = useMutation({
        mutationFn: ({ columnId, name }: { columnId: string; name: string }) =>
            renameBoardColumn(boardId, columnId, name),
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
        }) => deleteBoardColumn(boardId, columnId, moveTasksTo),
        onSuccess: () => {
            invalidateBoardColumns(queryClient, projectId);
        },
    });

    const reorderColumnsMutation = useMutation({
        mutationFn: (columnIds: string[]) =>
            reorderBoardColumns(boardId, columnIds),
        onError: () => {
            toast.error("Failed to reorder columns");
        },
        onSettled: () => {
            invalidateBoardColumns(queryClient, projectId);
        },
    });

    const columns = columnsQuery.data ?? [];

    return {
        addColumn: (name: string) => addColumnMutation.mutateAsync(name),
        columns,
        /** True once columns have been fetched (including an empty list). */
        columnsReady: columnsQuery.data !== undefined,
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
        reorderColumns: (activeId: string, overId: string) => {
            const oldIndex = columns.findIndex(
                (column) => column.id === activeId
            );
            const newIndex = columns.findIndex(
                (column) => column.id === overId
            );
            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
                return;
            }

            const next = [...columns];
            const [moved] = next.splice(oldIndex, 1);
            if (!moved) return;
            next.splice(newIndex, 0, moved);

            const ordered = next.map((column) => column.id);
            queryClient.setQueryData<BoardColumn[]>(
                boardKeys.columns(projectId, boardId),
                (current) =>
                    current
                        ? orderColumnsByIds(current, ordered)
                        : orderColumnsByIds(columns, ordered)
            );
            reorderColumnsMutation.mutate(ordered);
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
