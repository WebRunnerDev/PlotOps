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
import { useSprintMutations } from "@/features/sprints/model/use-sprints";
import { Button } from "@/shared/shadcn/ui/button";
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

type CancelSprintDialogProperties = {
    boardId: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    projectId: string;
    sprint: Sprint;
};

type CloseSprintDialogProperties = {
    boardId: string;
    columns: Array<{ id: string; isDone: boolean }>;
    draftSprints: Sprint[];
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
    boardId,
    columns,
    draftSprints,
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

    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [carryoverByTaskId, setCarryoverByTaskId] = useState<
        Record<string, CarryoverTarget>
    >({});
    const [bulkTarget, setBulkTarget] = useState<CarryoverTarget>("backlog");
    const [newDraftName, setNewDraftName] = useState("");
    const wasOpenReference = useRef(false);

    const incompleteIds = useMemo(
        () =>
            incompleteMemberTaskIds(
                tasks.map((task) => task.id),
                completedIds
            ),
        [completedIds, tasks]
    );

    const incompleteTasks = useMemo(
        () => tasks.filter((task) => incompleteIds.includes(task.id)),
        [incompleteIds, tasks]
    );

    const needsNewDraft = Object.values(carryoverByTaskId).includes("new");

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
        setCarryoverByTaskId((previousCarryover) =>
            syncCarryoverByTaskId(previousCarryover, nextIncomplete)
        );
    };

    const setTaskCarryover = (taskId: string, target: CarryoverTarget) => {
        setCarryoverByTaskId((previous) => ({
            ...previous,
            [taskId]: target,
        }));
    };

    const handleBulkApply = () => {
        setCarryoverByTaskId((previous) =>
            setAllCarryoverTargets(previous, bulkTarget)
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
            toast.success(t("sprints.closed", { name: sprint.name }));
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
            {draftSprints.map((draft) => (
                <option key={draft.id} value={draft.id}>
                    {draft.name}
                </option>
            ))}
            <option value="new">{t("sprints.carryoverNew")}</option>
        </>
    );

    return (
        <Dialog onOpenChange={handleOpen} open={open}>
            <DialogContent className="max-h-[85dvh] w-full min-w-0 overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {t("sprints.closeTitle", { name: sprint.name })}
                    </DialogTitle>
                    <DialogDescription>
                        {t("sprints.closeDescription")}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-2">
                    <p className="text-ui text-muted-foreground">
                        {t("sprints.completedHint")}
                    </p>
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {tasks.map((task) => {
                            const suggested = suggestedCompleted.has(task.id);
                            const checked = completedIds.has(task.id);
                            return (
                                <li
                                    className="flex items-start gap-3 px-3 py-2"
                                    key={task.id}
                                >
                                    <input
                                        checked={checked}
                                        className="mt-1 size-4 accent-primary"
                                        onChange={(event) =>
                                            toggleCompleted(
                                                task.id,
                                                event.target.checked
                                            )
                                        }
                                        type="checkbox"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-code text-muted-foreground">
                                            {task.key}
                                            {suggested ? (
                                                <span className="ml-2 text-meta text-primary">
                                                    {t("sprints.suggested")}
                                                </span>
                                            ) : null}
                                        </p>
                                        <p className="truncate text-ui">
                                            {task.title}
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                        {tasks.length === 0 ? (
                            <li className="px-3 py-4 text-ui text-muted-foreground">
                                {t("sprints.emptySprint")}
                            </li>
                        ) : null}
                    </ul>
                </div>

                {incompleteTasks.length > 0 ? (
                    <div className="grid gap-2">
                        <Label>{t("sprints.carryoverLabel")}</Label>
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                            <select
                                aria-label={t("sprints.carryoverBulkLabel")}
                                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-ui focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                id="carryover-bulk"
                                onChange={(event) =>
                                    setBulkTarget(
                                        event.target.value as CarryoverTarget
                                    )
                                }
                                value={bulkTarget}
                            >
                                {renderCarryoverOptions()}
                            </select>
                            <Button
                                className="shrink-0"
                                onClick={handleBulkApply}
                                type="button"
                                variant="outline"
                            >
                                {t("sprints.carryoverBulkApply")}
                            </Button>
                        </div>
                        <ul className="divide-y divide-border rounded-md border border-border">
                            {incompleteTasks.map((task) => (
                                <li
                                    className="flex min-w-0 flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center"
                                    key={task.id}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-code text-muted-foreground">
                                            {task.key}
                                        </p>
                                        <p className="truncate text-ui">
                                            {task.title}
                                        </p>
                                    </div>
                                    <select
                                        aria-label={t(
                                            "sprints.carryoverTaskLabel",
                                            { key: task.key }
                                        )}
                                        className="h-9 w-full shrink-0 rounded-md border border-input bg-background px-3 text-ui focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:w-48"
                                        onChange={(event) =>
                                            setTaskCarryover(
                                                task.id,
                                                event.target
                                                    .value as CarryoverTarget
                                            )
                                        }
                                        value={
                                            carryoverByTaskId[task.id] ??
                                            "backlog"
                                        }
                                    >
                                        {renderCarryoverOptions()}
                                    </select>
                                </li>
                            ))}
                        </ul>
                        {needsNewDraft ? (
                            <Input
                                onChange={(event) =>
                                    setNewDraftName(event.target.value)
                                }
                                placeholder={t("sprints.newDraftPlaceholder")}
                                value={newDraftName}
                            />
                        ) : null}
                    </div>
                ) : null}

                <DialogFooter>
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
