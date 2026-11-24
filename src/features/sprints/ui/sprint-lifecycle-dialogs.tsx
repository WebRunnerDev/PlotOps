import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Sprint } from "@/features/sprints/model/types";
import type { Task } from "@/features/tasks";

import {
    defaultSprintEndDate,
    todayIsoDate,
} from "@/features/sprints/api/sprints-api";
import {
    type CarryoverTarget,
    defaultCarryoverByTaskId,
    incompleteMemberTaskIds,
    resolveCarryoverSprintIds,
    setAllCarryoverTargets,
    syncCarryoverByTaskId,
} from "@/features/sprints/model/carryover-targets";
import { suggestedCompletedTaskIds } from "@/features/sprints/model/suggested-completed-task-ids";
import { summarizeTaskEstimates } from "@/features/sprints/model/summarize-task-estimates";
import { useSprintMutations } from "@/features/sprints/model/use-sprints";
import { isTaskEstimate } from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type CancelSprintDialogProperties = {
    boardId: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    projectId: string;
    sprint: Sprint;
};

type CloseSprintDialogProperties = {
    activeSprints?: Sprint[];
    boardId: string;
    columns: Array<{ id: string; isDone: boolean; name: string }>;
    draftSprints: Sprint[];
    /** Shown as a "View report" toast action after a successful Close. */
    onClosed?: (sprintId: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    projectId: string;
    sprint: Sprint;
    tasks: Task[];
};

type StartSprintDialogProperties = {
    boardId: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    projectId: string;
    sprint: Sprint;
    taskCount: number;
};

export function CancelSprintDialog({
    boardId,
    onOpenChange,
    open,
    projectId,
    sprint,
}: CancelSprintDialogProperties) {
    const { t } = useTranslation("board");
    const { cancel } = useSprintMutations(projectId, boardId);

    const handleCancel = async () => {
        try {
            await cancel.mutateAsync(sprint.id);
            toast.success(t("sprints.canceled", { name: sprint.name }));
            onOpenChange(false);
        } catch {
            toast.error(t("sprints.cancelFailed"));
        }
    };

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="w-full min-w-0 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {t("sprints.cancelTitle", { name: sprint.name })}
                    </DialogTitle>
                    <DialogDescription>
                        {t("sprints.cancelDescription")}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        {t("sprints.cancelAction")}
                    </Button>
                    <Button
                        disabled={cancel.isPending}
                        onClick={() => void handleCancel()}
                        type="button"
                        variant="destructive"
                    >
                        {t("sprints.cancelConfirm")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function CloseSprintDialog({
    activeSprints = [],
    boardId,
    columns,
    draftSprints,
    onClosed,
    onOpenChange,
    open,
    projectId,
    sprint,
    tasks,
}: CloseSprintDialogProperties) {
    const { t } = useTranslation("board");
    const { close, createDraft, removeDraft } = useSprintMutations(
        projectId,
        boardId
    );
    const suggestedCompleted = useMemo(
        () =>
            suggestedCompletedTaskIds({
                columns,
                tasks: tasks.map((task) => ({
                    id: task.id,
                    status: task.status,
                })),
            }),
        [columns, tasks]
    );
    const statusNameById = useMemo(
        () => new Map(columns.map((column) => [column.id, column.name])),
        [columns]
    );

    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [carryoverByTaskId, setCarryoverByTaskId] = useState<
        Record<string, CarryoverTarget>
    >({});
    const [bulkTarget, setBulkTarget] = useState<CarryoverTarget>("backlog");
    const [newDraftName, setNewDraftName] = useState("");
    const wasOpenReference = useRef(false);

    // Suggested (Done column) first, then the rest — keeps the list stable
    // while the user toggles checkboxes.
    const orderedTasks = useMemo(
        () =>
            tasks.toSorted(
                (left, right) =>
                    Number(suggestedCompleted.has(right.id)) -
                    Number(suggestedCompleted.has(left.id))
            ),
        [suggestedCompleted, tasks]
    );

    const incompleteIds = useMemo(
        () =>
            incompleteMemberTaskIds(
                tasks.map((task) => task.id),
                completedIds
            ),
        [completedIds, tasks]
    );

    const completedSummary = useMemo(
        () =>
            summarizeTaskEstimates(
                tasks.filter((task) => completedIds.has(task.id))
            ),
        [completedIds, tasks]
    );
    const incompleteSummary = useMemo(
        () =>
            summarizeTaskEstimates(
                tasks.filter((task) => !completedIds.has(task.id))
            ),
        [completedIds, tasks]
    );
    const showPoints =
        completedSummary.estimatedCount + incompleteSummary.estimatedCount > 0;

    const needsNewDraft = Object.values(carryoverByTaskId).includes("new");
    const targetsMixed = new Set(Object.values(carryoverByTaskId)).size > 1;

    useEffect(() => {
        if (open && !wasOpenReference.current) {
            const suggested = new Set(suggestedCompleted);
            const nextIncomplete = incompleteMemberTaskIds(
                tasks.map((task) => task.id),
                suggested
            );
            setCompletedIds(suggested);
            setCarryoverByTaskId(defaultCarryoverByTaskId(nextIncomplete));
            setBulkTarget("backlog");
            setNewDraftName("");
        }
        wasOpenReference.current = open;
    }, [open, suggestedCompleted, tasks]);

    const handleOpen = (next: boolean) => {
        onOpenChange(next);
    };

    const toggleCompleted = (taskId: string, checked: boolean) => {
        const nextCompleted = new Set(completedIds);
        if (checked) nextCompleted.add(taskId);
        else nextCompleted.delete(taskId);

        const nextIncomplete = incompleteMemberTaskIds(
            tasks.map((task) => task.id),
            nextCompleted
        );

        setCompletedIds(nextCompleted);
        setCarryoverByTaskId((previousCarryover) => {
            const synced = syncCarryoverByTaskId(
                previousCarryover,
                nextIncomplete
            );
            // A newly incomplete Task follows the bulk target.
            for (const id of nextIncomplete) {
                if (!(id in previousCarryover)) synced[id] = bulkTarget;
            }
            return synced;
        });
    };

    const setTaskCarryover = (taskId: string, target: CarryoverTarget) => {
        setCarryoverByTaskId((previous) => ({
            ...previous,
            [taskId]: target,
        }));
    };

    const setBulkCarryover = (target: CarryoverTarget) => {
        setBulkTarget(target);
        setCarryoverByTaskId((previous) =>
            setAllCarryoverTargets(previous, target)
        );
    };

    const handleClose = async () => {
        let createdDraftId: null | string = null;
        try {
            if (needsNewDraft) {
                const name =
                    newDraftName.trim() ||
                    t("sprints.defaultNextName", { name: sprint.name });
                const created = await createDraft.mutateAsync({ name });
                createdDraftId = created.id;
            }

            const carryoverResolved = resolveCarryoverSprintIds(
                carryoverByTaskId,
                createdDraftId
            );

            await close.mutateAsync({
                carryoverByTaskId: carryoverResolved,
                completedTaskIds: [...completedIds],
                sprintId: sprint.id,
            });
            toast.success(
                t("sprints.closed", { name: sprint.name }),
                onClosed
                    ? {
                          action: {
                              label: t("sprints.viewReport"),
                              onClick: () => {
                                  onClosed(sprint.id);
                              },
                          },
                      }
                    : undefined
            );
            handleOpen(false);
        } catch {
            if (createdDraftId) {
                try {
                    await removeDraft.mutateAsync(createdDraftId);
                } catch {
                    // Best-effort cleanup of orphan draft from failed close.
                }
            }
            toast.error(t("sprints.closeFailed"));
        }
    };

    const renderCarryoverOptions = () => (
        <>
            <option value="backlog">{t("sprints.carryoverBacklog")}</option>
            {activeSprints
                .filter((item) => item.id !== sprint.id)
                .map((item) => (
                    <option key={item.id} value={item.id}>
                        {t("sprints.carryoverActiveNamed", { name: item.name })}
                    </option>
                ))}
            {draftSprints.map((draft) => (
                <option key={draft.id} value={draft.id}>
                    {t("sprints.carryoverDraftNamed", { name: draft.name })}
                </option>
            ))}
            <option value="new">{t("sprints.carryoverNew")}</option>
        </>
    );

    const formatSize = (summary: { pointsSum: number; taskCount: number }) =>
        showPoints
            ? t("sprints.closeSizePoints", {
                  count: summary.taskCount,
                  points: summary.pointsSum,
              })
            : t("sprints.reportTasksValue", { count: summary.taskCount });

    const selectClassName =
        "h-8 w-full min-w-0 rounded-none border border-input bg-background px-2 text-ui focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

    return (
        <Dialog onOpenChange={handleOpen} open={open}>
            <DialogContent className="flex max-h-[min(90dvh,48rem)] w-full min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="shrink-0 gap-3 border-b border-border px-4 pt-4 pb-4">
                    <DialogTitle>
                        {t("sprints.closeTitle", { name: sprint.name })}
                    </DialogTitle>
                    <DialogDescription>
                        {t("sprints.closeDescription")}
                    </DialogDescription>
                    <dl className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
                        <div className="flex min-w-0 flex-col gap-0.5 bg-background px-3 py-2">
                            <dt className="text-meta text-muted-foreground">
                                {t("sprints.closeStatCompleted")}
                            </dt>
                            <dd className="font-heading text-h3 tabular-nums text-primary">
                                {formatSize(completedSummary)}
                            </dd>
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5 bg-background px-3 py-2">
                            <dt className="text-meta text-muted-foreground">
                                {t("sprints.closeStatIncomplete")}
                            </dt>
                            <dd className="font-heading text-h3 tabular-nums">
                                {formatSize(incompleteSummary)}
                            </dd>
                        </div>
                    </dl>
                </DialogHeader>

                <div className="scrollbar-board min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                    {tasks.length === 0 ? (
                        <p className="px-4 py-6 text-ui text-muted-foreground">
                            {t("sprints.emptySprint")}
                        </p>
                    ) : (
                        <div className="flex min-w-0 flex-col gap-3 px-4 py-4">
                            {incompleteIds.length > 0 ? (
                                <div className="grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(0,16rem)] sm:items-center sm:gap-3">
                                    <Label htmlFor="carryover-bulk">
                                        {t("sprints.carryoverMoveAll", {
                                            count: incompleteIds.length,
                                        })}
                                    </Label>
                                    <select
                                        className={selectClassName}
                                        id="carryover-bulk"
                                        onChange={(event) =>
                                            setBulkCarryover(
                                                event.target
                                                    .value as CarryoverTarget
                                            )
                                        }
                                        value={targetsMixed ? "" : bulkTarget}
                                    >
                                        {targetsMixed ? (
                                            <option disabled value="">
                                                {t("sprints.carryoverMixed")}
                                            </option>
                                        ) : null}
                                        {renderCarryoverOptions()}
                                    </select>
                                    {needsNewDraft ? (
                                        <>
                                            <Label htmlFor="carryover-new-draft">
                                                {t(
                                                    "sprints.carryoverNewDraftName"
                                                )}
                                            </Label>
                                            <Input
                                                className="h-8 rounded-none"
                                                id="carryover-new-draft"
                                                onChange={(event) =>
                                                    setNewDraftName(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder={t(
                                                    "sprints.defaultNextName",
                                                    { name: sprint.name }
                                                )}
                                                value={newDraftName}
                                            />
                                        </>
                                    ) : null}
                                </div>
                            ) : null}

                            <p className="text-sm text-muted-foreground">
                                {t("sprints.closeListHint")}
                            </p>

                            <ul className="min-w-0 divide-y divide-border border border-border">
                                {orderedTasks.map((task) => {
                                    const checked = completedIds.has(task.id);
                                    const checkboxId = `close-complete-${task.id}`;
                                    return (
                                        <li
                                            className={cn(
                                                "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_10rem]",
                                                checked && "bg-primary/5"
                                            )}
                                            key={task.id}
                                        >
                                            <Checkbox
                                                aria-label={t(
                                                    "sprints.closeMarkCompleted",
                                                    { key: task.key }
                                                )}
                                                checked={checked}
                                                id={checkboxId}
                                                onCheckedChange={(next) => {
                                                    toggleCompleted(
                                                        task.id,
                                                        next === true
                                                    );
                                                }}
                                            />
                                            <label
                                                className="flex min-w-0 cursor-pointer flex-col"
                                                htmlFor={checkboxId}
                                            >
                                                <span className="truncate text-ui">
                                                    {task.title}
                                                </span>
                                                <span className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
                                                    <span className="font-mono">
                                                        {task.key}
                                                    </span>
                                                    <span className="inline-block max-w-32 truncate border border-border bg-muted px-1.5 py-px text-foreground">
                                                        {statusNameById.get(
                                                            task.status
                                                        ) ?? task.status}
                                                    </span>
                                                    {isTaskEstimate(
                                                        task.estimate
                                                    ) ? (
                                                        <span className="tabular-nums">
                                                            {t(
                                                                "sprints.reportPointsValue",
                                                                {
                                                                    count: task.estimate,
                                                                }
                                                            )}
                                                        </span>
                                                    ) : null}
                                                </span>
                                            </label>
                                            <span className="hidden text-meta sm:block">
                                                {checked ? (
                                                    <span className="text-primary">
                                                        {t(
                                                            "sprints.closeRowCompleted"
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        {t(
                                                            "sprints.closeRowMoveTo"
                                                        )}
                                                    </span>
                                                )}
                                            </span>
                                            {checked ? (
                                                <span className="hidden sm:block" />
                                            ) : (
                                                <select
                                                    aria-label={t(
                                                        "sprints.carryoverTaskLabel",
                                                        { key: task.key }
                                                    )}
                                                    className={cn(
                                                        selectClassName,
                                                        "col-start-2 sm:col-start-auto"
                                                    )}
                                                    onChange={(event) =>
                                                        setTaskCarryover(
                                                            task.id,
                                                            event.target
                                                                .value as CarryoverTarget
                                                        )
                                                    }
                                                    value={
                                                        carryoverByTaskId[
                                                            task.id
                                                        ] ?? "backlog"
                                                    }
                                                >
                                                    {renderCarryoverOptions()}
                                                </select>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>

                <DialogFooter className="shrink-0">
                    <Button
                        onClick={() => handleOpen(false)}
                        type="button"
                        variant="outline"
                    >
                        {t("sprints.cancelAction")}
                    </Button>
                    <Button
                        disabled={close.isPending || createDraft.isPending}
                        onClick={() => void handleClose()}
                        type="button"
                    >
                        {close.isPending || createDraft.isPending ? (
                            <Spinner data-icon="inline-start" />
                        ) : null}
                        {t("sprints.closeConfirm")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function StartSprintDialog({
    boardId,
    onOpenChange,
    open,
    projectId,
    sprint,
    taskCount,
}: StartSprintDialogProperties) {
    const { t } = useTranslation("board");
    const { start } = useSprintMutations(projectId, boardId);
    const [startsOn, setStartsOn] = useState(todayIsoDate());
    const [endsOn, setEndsOn] = useState(defaultSprintEndDate(todayIsoDate()));

    useEffect(() => {
        if (!open) return;
        const start = todayIsoDate();
        setStartsOn(start);
        setEndsOn(defaultSprintEndDate(start));
    }, [open]);

    const handleOpen = (next: boolean) => {
        onOpenChange(next);
    };

    const handleStart = async () => {
        try {
            await start.mutateAsync({
                endsOn,
                sprintId: sprint.id,
                startsOn,
            });
            toast.success(t("sprints.started", { name: sprint.name }));
            handleOpen(false);
        } catch {
            toast.error(t("sprints.startFailed"));
        }
    };

    return (
        <Dialog onOpenChange={handleOpen} open={open}>
            <DialogContent className="w-full min-w-0 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {t("sprints.startTitle", { name: sprint.name })}
                    </DialogTitle>
                    <DialogDescription>
                        {t("sprints.startDescription", { count: taskCount })}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                    <div className="grid gap-1.5">
                        <Label htmlFor="sprint-start">
                            {t("sprints.startsOn")}
                        </Label>
                        <Input
                            id="sprint-start"
                            onChange={(event) => {
                                const value = event.target.value;
                                setStartsOn(value);
                                if (value && (!endsOn || endsOn < value)) {
                                    setEndsOn(defaultSprintEndDate(value));
                                }
                            }}
                            type="date"
                            value={startsOn}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="sprint-end">
                            {t("sprints.endsOn")}
                        </Label>
                        <Input
                            id="sprint-end"
                            min={startsOn}
                            onChange={(event) => setEndsOn(event.target.value)}
                            type="date"
                            value={endsOn}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        onClick={() => handleOpen(false)}
                        type="button"
                        variant="outline"
                    >
                        {t("sprints.cancelAction")}
                    </Button>
                    <Button
                        disabled={
                            start.isPending ||
                            !startsOn ||
                            !endsOn ||
                            endsOn < startsOn
                        }
                        onClick={() => void handleStart()}
                        type="button"
                    >
                        {t("sprints.startConfirm")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
