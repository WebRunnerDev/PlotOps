import {
    ArrowRightLeft,
    ChevronLeft,
    ChevronRight,
    Plus,
    Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { ProjectLabel, Task } from "@/features/tasks/model/types";

import {
    getLabelDotProps,
    isValidHexColor,
    LABEL_COLORS,
    LABEL_DOT_CLASS,
} from "@/features/tasks/model/constants";
import { useBoard } from "@/features/tasks/model/use-board";
import { useProjects } from "@/features/projects/model/use-projects";
import type { Project } from "@/features/projects/model/types";
import { cn } from "@/shared/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/shadcn/ui/alert-dialog";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/shared/shadcn/ui/empty";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/shadcn/ui/select";

const EMPTY_TASKS: Task[] = [];
const TASKS_PAGE_SIZE = 5;

/** Normalize a hex string to lowercase `#rrggbb`, expanding shorthand. Returns undefined if invalid. */
function normalizeHex(value: string): string | undefined {
    const trimmed = value.trim().toLowerCase();
    if (!isValidHexColor(trimmed)) return undefined;
    if (trimmed.length === 4) {
        const [, r, g, b] = trimmed;
        return `#${r}${r}${g}${g}${b}${b}`;
    }
    return trimmed;
}

type ProjectLabelsSettingsProperties = {
    projectId: string;
};

export function ProjectLabelsSettings({
    projectId,
}: ProjectLabelsSettingsProperties) {
    const { t } = useTranslation("board");
    const {
        addLabel,
        labels,
        tasks,
    } = useBoard(projectId);

    const { data: projects } = useProjects();

    const [newName, setNewName] = useState("");

    const projectLabels = useMemo(
        () =>
            labels
                .filter((label) => label.projectId === projectId)
                .sort((a, b) => a.name.localeCompare(b.name)),
        [labels, projectId],
    );

    const tasksByLabel = useMemo(() => {
        const map = new Map<string, Task[]>();
        for (const task of tasks) {
            for (const id of task.labelIds ?? []) {
                const list = map.get(id);
                if (list) {
                    list.push(task);
                } else {
                    map.set(id, [task]);
                }
            }
        }
        return map;
    }, [tasks]);

    const otherProjects = useMemo(
        () => (projects ?? []).filter((project) => project.id !== projectId),
        [projects, projectId],
    );

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed) return;

        const id = await addLabel(trimmed);
        if (!id) {
            toast.error(t("labels.createFailed"));
            return;
        }

        toast.success(t("labels.created", { name: trimmed }));
        setNewName("");
    };

    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2 className="text-h4 font-medium">
                    {t("labelSettings.title")}
                </h2>
                <p className="text-ui text-muted-foreground">
                    {t("labelSettings.description")}
                </p>
            </div>

            <div className="flex items-center gap-2">
                <Input
                    aria-label={t("labelSettings.newPlaceholder")}
                    className="max-w-xs"
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            handleCreate();
                        }
                    }}
                    placeholder={t("labelSettings.newPlaceholder")}
                    value={newName}
                />
                <Button
                    disabled={newName.trim().length === 0}
                    onClick={handleCreate}
                    type="button"
                >
                    <Plus data-icon="inline-start" />
                    {t("labelSettings.create")}
                </Button>
            </div>

            {projectLabels.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t("labelSettings.emptyTitle")}</EmptyTitle>
                        <EmptyDescription>
                            {t("labelSettings.emptyDescription")}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {projectLabels.map((label) => (
                        <LabelRow
                            key={label.id}
                            label={label}
                            otherProjects={otherProjects}
                            projectId={projectId}
                            taggedTasks={tasksByLabel.get(label.id) ?? EMPTY_TASKS}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

type LabelRowProperties = {
    label: ProjectLabel;
    otherProjects: Project[];
    projectId: string;
    taggedTasks: Task[];
};

function LabelRow({
    label,
    otherProjects,
    projectId,
    taggedTasks,
}: LabelRowProperties) {
    const { t } = useTranslation("board");
    const {
        copyLabelToProject,
        deleteLabel,
        moveLabelToProject,
        renameLabel,
        setLabelCustomColor,
        updateLabelColor,
    } = useBoard(projectId);

    const [draft, setDraft] = useState(label.name);
    const [colorOpen, setColorOpen] = useState(false);
    const [customDraft, setCustomDraft] = useState(
        label.customColor ?? "#6366f1",
    );
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [taskPage, setTaskPage] = useState(0);
    const [targetProjectId, setTargetProjectId] = useState<string | undefined>(
        otherProjects[0]?.id,
    );

    const usageCount = taggedTasks.length;
    const totalTaskPages = Math.max(
        1,
        Math.ceil(usageCount / TASKS_PAGE_SIZE),
    );
    const pageTasks = taggedTasks.slice(
        taskPage * TASKS_PAGE_SIZE,
        taskPage * TASKS_PAGE_SIZE + TASKS_PAGE_SIZE,
    );

    useEffect(() => {
        setDraft(label.name);
    }, [label.name]);

    useEffect(() => {
        if (colorOpen && label.customColor) {
            setCustomDraft(label.customColor);
        }
    }, [colorOpen, label.customColor]);

    const applyCustomColor = () => {
        const normalized = normalizeHex(customDraft);
        if (!normalized) {
            toast.error(t("labelSettings.customColorInvalid"));
            return;
        }
        void setLabelCustomColor(label.id, normalized);
        setColorOpen(false);
    };

    useEffect(() => {
        if (deleteOpen) setTaskPage(0);
    }, [deleteOpen]);

    useEffect(() => {
        if (transferOpen) setTargetProjectId(otherProjects[0]?.id);
    }, [otherProjects, transferOpen]);

    const commitRename = async () => {
        const trimmed = draft.trim();
        if (!trimmed || trimmed === label.name) {
            setDraft(label.name);
            return;
        }

        const ok = await renameLabel(label.id, trimmed);
        if (!ok) {
            toast.error(t("labels.createFailed"));
            setDraft(label.name);
        }
    };

    const handleConfirmDelete = async () => {
        await deleteLabel(label.id);
        toast.success(t("labelSettings.deleted", { name: label.name }));
        setDeleteOpen(false);
    };

    const handleCopy = async () => {
        if (!targetProjectId) return;
        const id = await copyLabelToProject(label.id, targetProjectId);
        const target = otherProjects.find(
            (project) => project.id === targetProjectId,
        );

        if (!id) {
            toast.error(t("labelSettings.transferDuplicate"));
            return;
        }

        toast.success(
            t("labelSettings.copied", {
                name: label.name,
                target: target?.name ?? "",
            }),
        );
        setTransferOpen(false);
    };

    const handleMove = async () => {
        if (!targetProjectId) return;
        const target = otherProjects.find(
            (project) => project.id === targetProjectId,
        );

        await moveLabelToProject(label.id, targetProjectId);
        toast.success(
            t("labelSettings.moved", {
                name: label.name,
                target: target?.name ?? "",
            }),
        );
        setTransferOpen(false);
    };

    const triggerDot = getLabelDotProps(label);

    return (
        <li className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5 ring-1 ring-foreground/10">
            <DropdownMenu onOpenChange={setColorOpen} open={colorOpen}>
                <DropdownMenuTrigger
                    aria-label={t("labelSettings.changeColor")}
                    render={<Button size="icon-sm" variant="ghost" />}
                >
                    <span
                        className={cn(
                            "size-3.5 rounded-full",
                            triggerDot.className,
                        )}
                        style={triggerDot.style}
                    />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-auto min-w-0">
                    <div className="flex flex-col gap-2 p-1">
                        <div className="grid grid-cols-5 gap-1">
                            {LABEL_COLORS.map((color) => (
                                <button
                                    aria-label={color}
                                    className={cn(
                                        "flex size-7 items-center justify-center rounded-md outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring",
                                        !label.customColor &&
                                            color === label.color &&
                                            "bg-foreground/10",
                                    )}
                                    key={color}
                                    onClick={() => {
                                        void updateLabelColor(label.id, color);
                                        setColorOpen(false);
                                    }}
                                    type="button"
                                >
                                    <span
                                        className={cn(
                                            "size-3.5 rounded-full",
                                            LABEL_DOT_CLASS[color],
                                        )}
                                    />
                                </button>
                            ))}
                        </div>

                        <div className="h-px bg-foreground/10" />

                        <p className="px-0.5 text-meta text-muted-foreground">
                            {t("labelSettings.customColor")}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <input
                                aria-label={t("labelSettings.customColor")}
                                className="size-8 shrink-0 cursor-pointer rounded-md border border-foreground/15 bg-transparent p-0.5"
                                onChange={(event) =>
                                    setCustomDraft(event.target.value)
                                }
                                type="color"
                                value={
                                    isValidHexColor(customDraft)
                                        ? customDraft
                                        : "#6366f1"
                                }
                            />
                            <Input
                                aria-label={t("labelSettings.customColorHex")}
                                className="h-8 w-24 font-mono text-sm"
                                onChange={(event) =>
                                    setCustomDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        applyCustomColor();
                                    }
                                }}
                                placeholder="#6366f1"
                                value={customDraft}
                            />
                            <Button
                                disabled={!normalizeHex(customDraft)}
                                onClick={applyCustomColor}
                                size="sm"
                                type="button"
                            >
                                {t("labelSettings.customColorApply")}
                            </Button>
                        </div>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            <Input
                aria-label={t("labelSettings.renameAria")}
                className="h-8 flex-1 border-transparent bg-transparent px-1.5 font-medium shadow-none focus-visible:border-ring focus-visible:bg-background"
                onBlur={commitRename}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                        setDraft(label.name);
                        event.currentTarget.blur();
                    }
                }}
                value={draft}
            />

            <Badge
                className="shrink-0 font-mono text-[0.625rem]"
                variant="secondary"
            >
                {t("labelSettings.usage", { count: usageCount })}
            </Badge>

            <Button
                aria-label={t("labelSettings.transfer")}
                disabled={otherProjects.length === 0}
                onClick={() => setTransferOpen(true)}
                size="icon-sm"
                type="button"
                variant="ghost"
            >
                <ArrowRightLeft className="size-3.5" />
            </Button>

            <Button
                aria-label={t("labelSettings.delete")}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                size="icon-sm"
                type="button"
                variant="ghost"
            >
                <Trash2 className="size-3.5" />
            </Button>

            <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
                <AlertDialogContent
                    className={usageCount > 0 ? "sm:max-w-md" : undefined}
                    size="sm"
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("labelSettings.deleteTitle", { name: label.name })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {usageCount > 0
                                ? t("labelSettings.deleteWithTasks", {
                                      count: usageCount,
                                  })
                                : t("labelSettings.deleteEmpty")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {usageCount > 0 ? (
                        <div className="flex flex-col gap-2">
                            <ul className="flex flex-col gap-1">
                                {pageTasks.map((task) => (
                                    <li
                                        className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm"
                                        key={task.id}
                                    >
                                        <span
                                            aria-hidden
                                            className={cn(
                                                "size-2 shrink-0 rounded-full",
                                                triggerDot.className,
                                            )}
                                            style={triggerDot.style}
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {task.title}
                                        </span>
                                        <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground">
                                            {task.id}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {totalTaskPages > 1 ? (
                                <div className="flex items-center justify-between">
                                    <Button
                                        aria-label={t("labelSettings.prevPage")}
                                        disabled={taskPage === 0}
                                        onClick={() =>
                                            setTaskPage((page) =>
                                                Math.max(0, page - 1),
                                            )
                                        }
                                        size="icon-sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        <ChevronLeft className="size-4" />
                                    </Button>
                                    <span className="text-meta text-muted-foreground">
                                        {t("labelSettings.page", {
                                            page: taskPage + 1,
                                            total: totalTaskPages,
                                        })}
                                    </span>
                                    <Button
                                        aria-label={t("labelSettings.nextPage")}
                                        disabled={
                                            taskPage >= totalTaskPages - 1
                                        }
                                        onClick={() =>
                                            setTaskPage((page) =>
                                                Math.min(
                                                    totalTaskPages - 1,
                                                    page + 1,
                                                ),
                                            )
                                        }
                                        size="icon-sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                            ) : undefined}
                        </div>
                    ) : undefined}

                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t("labelSettings.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            variant="destructive"
                        >
                            {t("labelSettings.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog onOpenChange={setTransferOpen} open={transferOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {t("labelSettings.transferTitle", {
                                name: label.name,
                            })}
                        </DialogTitle>
                        <DialogDescription>
                            {t("labelSettings.transferDescription")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor={`transfer-target-${label.id}`}>
                            {t("labelSettings.targetProject")}
                        </Label>
                        <Select
                            onValueChange={(value) => {
                                if (typeof value === "string") {
                                    setTargetProjectId(value);
                                }
                            }}
                            value={targetProjectId}
                        >
                            <SelectTrigger
                                className="w-full"
                                id={`transfer-target-${label.id}`}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                                {otherProjects.map((project) => (
                                    <SelectItem
                                        key={project.id}
                                        value={project.id}
                                    >
                                        {project.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <DialogClose
                            render={<Button variant="outline" />}
                        >
                            {t("labelSettings.cancel")}
                        </DialogClose>
                        <Button
                            disabled={!targetProjectId}
                            onClick={handleCopy}
                            type="button"
                            variant="secondary"
                        >
                            {t("labelSettings.copy")}
                        </Button>
                        <Button
                            disabled={!targetProjectId}
                            onClick={handleMove}
                            type="button"
                        >
                            {t("labelSettings.move")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </li>
    );
}
