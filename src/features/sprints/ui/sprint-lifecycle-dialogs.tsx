import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Sprint } from "@/features/sprints/model/types";
import type { Task } from "@/features/tasks/model/types";

import {
    defaultSprintEndDate,
    todayIsoDate,
} from "@/features/sprints/api/sprints-api";
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
    columns: Array<{ id: string }>;
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
            <DialogContent className="sm:max-w-md">
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
    const { close, createDraft } = useSprintMutations(projectId, boardId);
    const lastColumnId = columns.at(-1)?.id;

    const suggestedCompleted = useMemo(() => {
        if (!lastColumnId) return new Set<string>();
        return new Set(
            tasks
                .filter((task) => task.status === lastColumnId)
                .map((task) => task.id)
        );
    }, [lastColumnId, tasks]);

    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [carryover, setCarryover] = useState<string>("backlog");
    const [newDraftName, setNewDraftName] = useState("");

    const handleOpen = (next: boolean) => {
        if (next) {
            setCompletedIds(new Set(suggestedCompleted));
            setCarryover("backlog");
            setNewDraftName("");
        }
        onOpenChange(next);
    };

    const toggleCompleted = (taskId: string, checked: boolean) => {
        setCompletedIds((previous) => {
            const next = new Set(previous);
            if (checked) next.add(taskId);
            else next.delete(taskId);
            return next;
        });
    };

    const handleClose = async () => {
        try {
            let carryoverSprintId: null | string = null;
            if (carryover === "new") {
                const name =
                    newDraftName.trim() ||
                    t("sprints.defaultNextName", { name: sprint.name });
                const created = await createDraft.mutateAsync({ name });
                carryoverSprintId = created.id;
            } else if (carryover !== "backlog") {
                carryoverSprintId = carryover;
            }

            await close.mutateAsync({
                carryoverSprintId,
                completedTaskIds: [...completedIds],
                sprintId: sprint.id,
            });
            toast.success(t("sprints.closed", { name: sprint.name }));
            onOpenChange(false);
        } catch {
            toast.error(t("sprints.closeFailed"));
        }
    };

    return (
        <Dialog onOpenChange={handleOpen} open={open}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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

                <div className="grid gap-2">
                    <Label htmlFor="carryover">
                        {t("sprints.carryoverLabel")}
                    </Label>
                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-ui"
                        id="carryover"
                        onChange={(event) => setCarryover(event.target.value)}
                        value={carryover}
                    >
                        <option value="backlog">
                            {t("sprints.carryoverBacklog")}
                        </option>
                        {draftSprints.map((draft) => (
                            <option key={draft.id} value={draft.id}>
                                {draft.name}
                            </option>
                        ))}
                        <option value="new">{t("sprints.carryoverNew")}</option>
                    </select>
                    {carryover === "new" ? (
                        <Input
                            onChange={(event) =>
                                setNewDraftName(event.target.value)
                            }
                            placeholder={t("sprints.newDraftPlaceholder")}
                            value={newDraftName}
                        />
                    ) : null}
                </div>

                <DialogFooter>
                    <Button
                        onClick={() => onOpenChange(false)}
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

    const handleOpen = (next: boolean) => {
        if (next) {
            const start = todayIsoDate();
            setStartsOn(start);
            setEndsOn(defaultSprintEndDate(start));
        }
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
            onOpenChange(false);
        } catch {
            toast.error(t("sprints.startFailed"));
        }
    };

    return (
        <Dialog onOpenChange={handleOpen} open={open}>
            <DialogContent className="sm:max-w-md">
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
                        onClick={() => onOpenChange(false)}
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
