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
                    <span className="block max-w-md text-ui sm:truncate">
                        {row.original.title}
                    </span>
                ),
                header: t("sprints.columnTitle"),
            },
            {
                cell: ({ row }) =>
                    row.original.estimate === undefined ? (
                        <span className="text-meta text-muted-foreground">
                            —
                        </span>
                    ) : (
                        <span className="text-code tabular-nums">
                            {row.original.estimate}
                        </span>
                    ),
                header: t("sprints.columnEstimate"),
                id: "estimate",
                size: 64,
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
                    "m-3 flex flex-col items-start justify-center gap-2 border border-dashed border-border/70 px-4 py-10 transition-[border-color,background-color,transform,box-shadow] duration-300 ease-(--ease-out-expo)",
                    isOver &&
                        "scale-[1.01] border-primary bg-primary/8 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent)]"
                )}
                ref={setNodeRef}
            >
                <p className="text-ui text-muted-foreground">
                    {t("sprints.emptySection")}
                </p>
                {canManage ? (
                    <p
                        className={cn(
                            "text-meta transition-colors duration-300 ease-(--ease-out-expo)",
                            isOver ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        {t("sprints.dropHint")}
                    </p>
                ) : null}
            </div>
        );
    }

    const rows = table.getRowModel().rows;

    return (
        <div
            className={cn(
                "transition-[background-color,box-shadow] duration-300 ease-(--ease-out-expo)",
                isOver &&
                    "bg-primary/5 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
            )}
            ref={setNodeRef}
        >
            <ul className="divide-y divide-border sm:hidden">
                {rows.map((row) => (
                    <DraggableTaskCard
                        canManage={canManage}
                        containerId={containerId}
                        isDragging={draggingTaskIds.includes(row.id)}
                        key={row.id}
                        onOpenTask={onOpenTask}
                        row={row}
                        rowSelection={rowSelection}
                    />
                ))}
            </ul>

            <div className="hidden sm:block">
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
                                                  header.column.columnDef
                                                      .header,
                                                  header.getContext()
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
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
        </div>
    );
}

function DraggableTaskCard({
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
    const {
        attributes,
        canDrag,
        isSelected,
        listeners,
        setNodeRef,
        suppressClickReference,
    } = useTaskDrag({
        canManage,
        containerId,
        isDragging,
        row,
        rowSelection,
    });

    const cells = row.getVisibleCells();
    const selectCell = cells.find((cell) => cell.column.id === "select");
    const keyCell = cells.find((cell) => cell.column.id === "key");
    const titleCell = cells.find((cell) => cell.column.id === "title");
    const metaCells = cells.filter(
        (cell) =>
            cell.column.id !== "select" &&
            cell.column.id !== "key" &&
            cell.column.id !== "title"
    );

    return (
        <li
            className={cn(
                "flex min-w-0 flex-col gap-2 px-3 py-2.5",
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
            {...(canDrag ? listeners : {})}
        >
            <div className="flex min-w-0 items-start gap-2">
                {selectCell ? (
                    <div
                        className="shrink-0 pt-0.5"
                        data-no-row-activate
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        {flexRender(
                            selectCell.column.columnDef.cell,
                            selectCell.getContext()
                        )}
                    </div>
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                    {keyCell
                        ? flexRender(
                              keyCell.column.columnDef.cell,
                              keyCell.getContext()
                          )
                        : null}
                    {titleCell ? (
                        <div className="min-w-0 text-ui wrap-break-word">
                            {flexRender(
                                titleCell.column.columnDef.cell,
                                titleCell.getContext()
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
            {metaCells.length > 0 ? (
                <div
                    className={cn(
                        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1",
                        selectCell && "pl-8"
                    )}
                >
                    {metaCells.map((cell) => (
                        <div
                            className="min-w-0 shrink-0"
                            key={cell.id}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                            )}
                        </div>
                    ))}
                </div>
            ) : null}
        </li>
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
    const {
        attributes,
        canDrag,
        isSelected,
        listeners,
        setNodeRef,
        suppressClickReference,
    } = useTaskDrag({
        canManage,
        containerId,
        isDragging,
        row,
        rowSelection,
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

function useTaskDrag({
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

    return {
        attributes,
        canDrag,
        isSelected,
        listeners,
        setNodeRef,
        suppressClickReference,
    };
}
