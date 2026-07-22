import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    type OnChangeFn,
    type Row,
    type RowSelectionState,
    useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Task } from "@/features/tasks/model/types";

import { cn } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/shadcn/ui/table";

export const BACKLOG_DROP_ID = "drop:backlog";

export type BacklogTaskDragData = {
    sourceContainerId: string;
    taskId: string;
    taskIds: string[];
    tasks: Task[];
    type: "backlog-task";
};

type SprintTaskTableProperties = {
    canManage: boolean;
    containerId: string;
    draggingTaskIds: string[];
    onRowSelectionChange: OnChangeFn<RowSelectionState>;
    rowSelection: RowSelectionState;
    tasks: Task[];
};

export function parseDropTarget(
    overId: null | number | string | undefined
): undefined | { kind: "backlog" | "sprint"; sprintId: null | string } {
    if (overId === undefined || overId === null) return undefined;
    const id = String(overId);
    if (id === BACKLOG_DROP_ID) {
        return { kind: "backlog", sprintId: null };
    }
    if (id.startsWith("drop:sprint:")) {
        return { kind: "sprint", sprintId: id.slice("drop:sprint:".length) };
    }
    return undefined;
}

export function sprintDropId(sprintId: string) {
    return `drop:sprint:${sprintId}`;
}

export function SprintTaskTable({
    canManage,
    containerId,
    draggingTaskIds,
    onRowSelectionChange,
    rowSelection,
    tasks,
}: SprintTaskTableProperties) {
    const { t } = useTranslation("board");
    const { isOver, setNodeRef } = useDroppable({
        disabled: !canManage,
        id: containerId,
    });

    const columns = useMemo<ColumnDef<Task>[]>(
        () => [
            {
                cell: ({ row }) =>
                    canManage ? (
                        <Checkbox
                            aria-label={t("sprints.selectTask", {
                                key: row.original.key,
                            })}
                            checked={row.getIsSelected()}
                            onCheckedChange={(checked) => {
                                row.toggleSelected(checked === true);
                            }}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                        />
                    ) : null,
                enableSorting: false,
                header: ({ table }) =>
                    canManage ? (
                        <Checkbox
                            aria-label={t("sprints.selectAllInSection")}
                            checked={table.getIsAllPageRowsSelected()}
                            indeterminate={table.getIsSomePageRowsSelected()}
                            onCheckedChange={(checked) => {
                                table.toggleAllPageRowsSelected(
                                    checked === true
                                );
                            }}
                        />
                    ) : null,
                id: "select",
                size: 40,
            },
            {
                accessorKey: "key",
                cell: ({ row }) => (
                    <span className="text-code text-muted-foreground">
                        {row.original.key}
                    </span>
                ),
                header: t("sprints.columnKey"),
                size: 120,
            },
            {
                accessorKey: "title",
                cell: ({ row }) => (
                    <span className="block max-w-md truncate text-ui">
                        {row.original.title}
                    </span>
                ),
                header: t("sprints.columnTitle"),
            },
        ],
        [canManage, t]
    );

    const table = useReactTable({
        columns,
        data: tasks,
        enableRowSelection: canManage,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        onRowSelectionChange,
        state: { rowSelection },
    });

    if (tasks.length === 0) {
        return (
            <div
                className={cn(
                    "px-3 py-6 transition-colors",
                    isOver && "bg-primary/5"
                )}
                ref={setNodeRef}
            >
                <p className="text-ui text-muted-foreground">
                    {t("sprints.emptySection")}
                </p>
                {canManage ? (
                    <p className="mt-1 text-meta text-muted-foreground">
                        {t("sprints.dropHint")}
                    </p>
                ) : null}
            </div>
        );
    }

    return (
        <div
            className={cn(
                "transition-colors",
                isOver && "bg-primary/5 ring-1 ring-inset ring-primary/30"
            )}
            ref={setNodeRef}
        >
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead
                                    key={header.id}
                                    style={{
                                        width:
                                            header.column.getSize() === 150
                                                ? undefined
                                                : header.column.getSize(),
                                    }}
                                >
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                              header.column.columnDef.header,
                                              header.getContext()
                                          )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.map((row) => (
                        <DraggableTaskRow
                            canManage={canManage}
                            containerId={containerId}
                            isDragging={draggingTaskIds.includes(row.id)}
                            key={row.id}
                            row={row}
                            rowSelection={rowSelection}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function DraggableTaskRow({
    canManage,
    containerId,
    isDragging,
    row,
    rowSelection,
}: {
    canManage: boolean;
    containerId: string;
    isDragging: boolean;
    row: Row<Task>;
    rowSelection: RowSelectionState;
}) {
    const isSelected = row.getIsSelected();
    const canDrag = canManage && isSelected;
    const selectedIds = Object.keys(rowSelection).filter(
        (id) => rowSelection[id]
    );
    const { attributes, listeners, setNodeRef } = useDraggable({
        data: {
            sourceContainerId: containerId,
            taskId: row.id,
            taskIds: selectedIds,
            tasks: [row.original],
            type: "backlog-task",
        } satisfies BacklogTaskDragData,
        disabled: !canDrag,
        id: row.id,
    });

    return (
        <TableRow
            className={cn(
                canDrag && "cursor-grab active:cursor-grabbing",
                !canDrag && canManage && "cursor-default",
                isDragging && "opacity-40",
                isSelected && "bg-muted/60"
            )}
            data-state={isSelected ? "selected" : undefined}
            ref={setNodeRef}
            {...(canDrag ? listeners : {})}
            {...(canDrag ? attributes : {})}
        >
            {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
            ))}
        </TableRow>
    );
}
