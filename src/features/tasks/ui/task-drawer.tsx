import {
    Check,
    Copy,
    ExternalLink,
    GitBranch,
    GitPullRequest,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type {
    Task,
    TaskPriority,
    TaskStatus,
} from "@/features/tasks/model/types";

import { TASK_PRIORITIES } from "@/features/tasks/model/constants";
import { useTasksStore } from "@/features/tasks/model/use-tasks-store";
import { TaskLabelsField } from "@/features/tasks/ui/task-labels-field";
import { uploadTaskMedia } from "@/features/tasks/api/upload-task-media";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@/shared/shadcn/ui/drawer";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/shadcn/ui/select";
import { RichTextEditor } from "@/shared/ui/rich-text-editor";
import { Separator } from "@/shared";

const PR_STATE_CLASS: Record<NonNullable<Task["pr"]>["state"], string> = {
    closed: "text-red-500",
    merged: "text-purple-500",
    open: "text-emerald-500",
};

const TASK_DRAWER_SNAP_POINTS = ["32rem", 0.92] as const;
const PRIORITY_NONE = "__none__";

type TaskDrawerProperties = {
    projectId: string;
};

export function TaskDrawer({ projectId }: TaskDrawerProperties) {
    const { t } = useTranslation("board");
    const selectedTaskId = useTasksStore((state) => state.selectedTaskId);
    const tasks = useTasksStore((state) => state.tasks);
    const columns = useTasksStore((state) => state.columns);
    const labels = useTasksStore((state) => state.labels);
    const clearSelectedTask = useTasksStore((state) => state.clearSelectedTask);
    const updateTaskDetails = useTasksStore((state) => state.updateTaskDetails);
    const updateTaskStatus = useTasksStore((state) => state.updateTaskStatus);

    const task = tasks.find((item) => item.id === selectedTaskId);

    const projectLabels = useMemo(
        () => labels.filter((label) => label.projectId === projectId),
        [labels, projectId],
    );

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!task) return;
        setTitle(task.title);
        setDescription(task.description ?? "");
        setCopied(false);
    }, [task]);

    const checkoutCommand = task?.branchName
        ? `git checkout ${task.branchName}`
        : undefined;

    const commitTitle = () => {
        if (!task) return;
        const next = title.trim();
        if (!next || next === task.title) {
            setTitle(task.title);
            return;
        }
        updateTaskDetails(task.id, { title: next });
    };

    const commitDescription = () => {
        if (!task) return;
        const next = description;
        const current = task.description ?? "";
        if (next === current) return;
        updateTaskDetails(task.id, {
            description: next.length > 0 ? next : undefined,
        });
    };

    const handleCopyCheckout = async () => {
        if (!checkoutCommand) return;

        try {
            await navigator.clipboard.writeText(checkoutCommand);
            setCopied(true);
            toast.success(t("copiedCheckout"));
            globalThis.setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error(t("copyFailed"));
        }
    };

    return (
        <Drawer
            onOpenChange={(open) => {
                if (!open) {
                    commitDescription();
                    clearSelectedTask();
                }
            }}
            open={Boolean(task)}
            showSwipeHandle
            snapPoints={[...TASK_DRAWER_SNAP_POINTS]}
            swipeDirection="down"
        >
            <DrawerContent>
                {task ? (
                    <>
                        <DrawerHeader className="text-left p-2">
                            <p className="text-meta text-muted-foreground">
                                {task.id}
                            </p>
                            <DrawerTitle className="sr-only">
                                {task.title}
                            </DrawerTitle>
                            <DrawerDescription>
                                {t("drawerDescription")}
                            </DrawerDescription>
                        </DrawerHeader>

                        <div className="mx-auto flex min-h-0 w-full min-w-7xl max-w-7xl flex-1 flex-col gap-6 overflow-y-auto p-4 md:flex-row">
                            {/* Title and Description */}
                            <div className="flex min-w-0 flex-[2_1_0%] flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="task-title">
                                        {t("fields.title")}
                                    </Label>
                                    <Input
                                        className="text-h3 font-medium"
                                        id="task-title"
                                        onBlur={commitTitle}
                                        onChange={(event) =>
                                            setTitle(event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.currentTarget.blur();
                                            }
                                        }}
                                        value={title}
                                    />
                                </div>

                                <div className="flex min-w-0 flex-col gap-2">
                                    <Label
                                        htmlFor="task-description"
                                        id="task-description-label"
                                    >
                                        {t("fields.description")}
                                    </Label>
                                    <RichTextEditor
                                        id="task-description"
                                        onBlur={commitDescription}
                                        onChange={setDescription}
                                        onUploadImage={(file) =>
                                            uploadTaskMedia(file, task.id)
                                        }
                                        placeholder={t(
                                            "fields.descriptionPlaceholder",
                                        )}
                                        value={description}
                                    />
                                </div>
                            </div>
                            <Separator
                                className="hidden shrink-0 md:block"
                                orientation="vertical"
                            />
                            {/* Status, Priority, Deadline */}
                            <div className="flex min-w-0 flex-[1_1_0%] flex-col gap-6">
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="task-status">
                                            {t("fields.status")}
                                        </Label>
                                        <Select
                                            onValueChange={(value) => {
                                                if (typeof value === "string") {
                                                    updateTaskStatus(
                                                        task.id,
                                                        value as TaskStatus,
                                                    );
                                                }
                                            }}
                                            value={task.status}
                                        >
                                            <SelectTrigger
                                                className="w-full"
                                                id="task-status"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent alignItemWithTrigger={false}>
                                                {columns.map((column) => (
                                                    <SelectItem
                                                        key={column.id}
                                                        value={column.id}
                                                    >
                                                        {column.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="task-priority">
                                            {t("fields.priority")}
                                        </Label>
                                        <Select
                                            onValueChange={(value) => {
                                                if (typeof value !== "string") {
                                                    return;
                                                }
                                                updateTaskDetails(task.id, {
                                                    priority:
                                                        value === PRIORITY_NONE
                                                            ? undefined
                                                            : (value as TaskPriority),
                                                });
                                            }}
                                            value={task.priority ?? PRIORITY_NONE}
                                        >
                                            <SelectTrigger
                                                className="w-full"
                                                id="task-priority"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent alignItemWithTrigger={false}>
                                                <SelectItem value={PRIORITY_NONE}>
                                                    {t("priority.none")}
                                                </SelectItem>
                                                {TASK_PRIORITIES.map((priority) => (
                                                    <SelectItem
                                                        key={priority}
                                                        value={priority}
                                                    >
                                                        {t(`priority.${priority}`)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="task-deadline">
                                            {t("fields.deadline")}
                                        </Label>
                                        <Input
                                            id="task-deadline"
                                            onChange={(event) => {
                                                const next = event.target.value;
                                                updateTaskDetails(task.id, {
                                                    deadline:
                                                        next.length > 0
                                                            ? next
                                                            : undefined,
                                                });
                                            }}
                                            type="date"
                                            value={task.deadline ?? ""}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Label>{t("fields.labels")}</Label>
                                    <TaskLabelsField
                                        labels={projectLabels}
                                        projectId={projectId}
                                        selectedIds={task.labelIds ?? []}
                                        taskId={task.id}
                                    />
                                </div>

                                <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
                                    <p className="text-meta text-muted-foreground">
                                        {t("github.title")}
                                    </p>

                                    {checkoutCommand ? (
                                        <div className="flex flex-col gap-2">
                                            <span className="inline-flex items-center gap-1.5 text-ui text-muted-foreground">
                                                <GitBranch
                                                    aria-hidden
                                                    className="size-3.5"
                                                />
                                                {t("github.checkout")}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <code className="min-w-0 flex-1 truncate rounded-md bg-background px-2.5 py-1.5 text-code ring-1 ring-foreground/10">
                                                    {checkoutCommand}
                                                </code>
                                                <Button
                                                    aria-label={t("github.copy")}
                                                    onClick={() => {
                                                        void handleCopyCheckout();
                                                    }}
                                                    size="icon-sm"
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    {copied ? (
                                                        <Check className="text-emerald-500" />
                                                    ) : (
                                                        <Copy />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-ui text-muted-foreground">
                                            {t("github.noBranch")}
                                        </p>
                                    )}

                                    {task.pr ? (
                                        <a
                                            className={cn(
                                                "inline-flex items-center gap-1.5 text-ui underline-offset-4 hover:underline",
                                                PR_STATE_CLASS[task.pr.state],
                                            )}
                                            href={task.pr.url}
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            <GitPullRequest
                                                aria-hidden
                                                className="size-3.5"
                                            />
                                            {t("github.prLink", {
                                                number: task.pr.number,
                                                state: t(
                                                    `prState.${task.pr.state}`,
                                                ),
                                            })}
                                            <ExternalLink
                                                aria-hidden
                                                className="size-3"
                                            />
                                        </a>
                                    ) : (
                                        <p className="text-ui text-muted-foreground">
                                            {t("github.noPr")}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : undefined}
            </DrawerContent>
        </Drawer>
    );
}
