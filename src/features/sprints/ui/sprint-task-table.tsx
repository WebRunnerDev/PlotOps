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
import { Calendar, User } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { ProjectLabel } from "@/features/labels";
import type { Task } from "@/features/tasks";

import { TaskLabelChips } from "@/features/labels";
import {
    formatDeadline,
    isDeadlineOverdue,
    PRIORITY_DOT_CLASS,
} from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
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
    labels: ProjectLabel[];
    onOpenTask?: (taskId: string) => void;
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
    labels,
    onOpenTask,
    onRowSelectionChange,
    rowSelection,
    tasks,
}: SprintTaskTableProperties) {
    const { i18n, t } = useTranslation("board");
    const { isOver, setNodeRef } = useDroppable({
        disabled: !canManage,
        id: containerId,
    });

    const labelsById = useMemo(() => {
        const map = new Map<string, ProjectLabel>();
        for (const label of labels) {
            map.set(label.id, label);
        }
        return map;
    }, [labels]);

    const columns = useMemo<ColumnDef<Task>[]>(
        () => [
            {
                cell: ({ row }) =>
                    canManage ? (
                        <div
                            className="flex items-center"
                            data-no-row-activate
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            <Checkbox
                                aria-label={t("sprints.selectTask", {
                                    key: row.original.key,
                                })}
                                checked={row.getIsSelected()}
                                onCheckedChange={(checked) => {
                                    row.toggleSelected(checked === true);
                                }}
                            />
                        </div>
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
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                        {row.original.priority ? (
                            <span
                                aria-hidden
                                className={cn(
                                    "size-1.5 shrink-0 rounded-full",
                                    PRIORITY_DOT_CLASS[row.original.priority]
                                )}
                            />
                        ) : null}
                        <span className="truncate text-code text-muted-foreground">
                            {row.original.key}
                        </span>
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
            {
                cell: ({ row }) => {
                    const taskLabels = (row.original.labelIds ?? [])
                        .map((id) => labelsById.get(id))
                        .filter(
                            (label): label is ProjectLabel =>
                                label !== undefined
                        );
                    return taskLabels.length > 0 ? (
                        <TaskLabelChips labels={taskLabels} max={2} />
                    ) : (
                        <span className="text-meta text-muted-foreground">
                            —
                        </span>
                    );
                },
                header: t("sprints.columnLabels"),
                id: "labels",
                size: 160,
            },
            {
                cell: ({ row }) => {
                    const assigneeName = row.original.assignee?.name;
                    return (
                        <Avatar size="sm">
                            {row.original.assignee?.avatarUrl ? (
                                <AvatarImage
                                    alt={assigneeName ?? ""}
                                    src={row.original.assignee.avatarUrl}
                                />
                            ) : null}
                            <AvatarFallback className="text-meta">
                                {assigneeName ? (
                                    initials(assigneeName)
                                ) : (
                                    <User className="size-3" />
                                )}
                            </AvatarFallback>
                        </Avatar>
                    );
                },
                header: t("sprints.columnAssignee"),
                id: "assignee",
                size: 48,
            },
            {
                cell: ({ row }) => {
                    const deadline = row.original.deadline;
                    if (!deadline) {
                        return (
                            <span className="text-meta text-muted-foreground">
                                —
                            </span>
                        );
                    }
                    const overdue = isDeadlineOverdue(deadline);
                    return (
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 text-code",
                                overdue
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                            )}
                        >
                            <Calendar aria-hidden className="size-3 shrink-0" />
                            {formatDeadline(deadline, i18n.language)}
                        </span>
                    );
                },
                header: t("sprints.columnDeadline"),
                id: "deadline",
                size: 100,
            },
        ],
        [canManage, i18n.language, labelsById, t]
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
                            onOpenTask={onOpenTask}
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
    onOpenTask,
    row,
    rowSelection,
}: {
    canManage: boolean;
    containerId: string;
    isDragging: boolean;
    onOpenTask?: (taskId: string) => void;
    row: Row<Task>;
    rowSelection: RowSelectionState;
}) {
    const isSelected = row.getIsSelected();
    const canDrag = canManage;
    const selectedIds = Object.keys(rowSelection).filter(
        (id) => rowSelection[id]
    );
    const dragTaskIds =
        isSelected && selectedIds.length > 0 ? selectedIds : [row.id];
    const suppressClickReference = useRef(false);

    useEffect(() => {
        if (isDragging) {
            suppressClickReference.current = true;
        }
    }, [isDragging]);

    const { attributes, listeners, setNodeRef } = useDraggable({
        data: {
            sourceContainerId: containerId,
            taskId: row.id,
            taskIds: dragTaskIds,
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
                onOpenTask && "hover:bg-muted/40",
                isDragging && "opacity-40",
                isSelected && "bg-muted/60"
            )}
            data-state={isSelected ? "selected" : undefined}
            onClick={(event) => {
                if (suppressClickReference.current) {
                    suppressClickReference.current = false;
                    return;
                }
                const target = event.target;
                if (
                    target instanceof Element &&
                    target.closest("[data-no-row-activate]")
                ) {
                    return;
                }
                onOpenTask?.(row.id);
            }}
            ref={setNodeRef}
            {...(canDrag ? attributes : {})}
        >
            {row.getVisibleCells().map((cell) => {
                const isSelectColumn = cell.column.id === "select";
                return (
                    <TableCell
                        className={cn(isSelectColumn && "cursor-default")}
                        data-no-row-activate={isSelectColumn ? true : undefined}
                        key={cell.id}
                        onClick={
                            isSelectColumn
                                ? (event) => event.stopPropagation()
                                : undefined
                        }
                        onPointerDown={
                            isSelectColumn
                                ? (event) => event.stopPropagation()
                                : undefined
                        }
                        {...(canDrag && !isSelectColumn ? listeners : {})}
                    >
                        {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                        )}
                    </TableCell>
                );
            })}
        </TableRow>
    );
}

function initials(name: string): string {
    const parts = name
        .trim()
        .split(/[\s_-]+/)
        .filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
}
