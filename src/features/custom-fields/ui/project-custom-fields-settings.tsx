import {
    ArrowDown,
    ArrowRightLeft,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    PanelBottom,
    Search,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type {
    CustomFieldTaskType,
    CustomFieldValueUsage,
    ProjectCustomField,
} from "@/features/custom-fields/model/types";
import type { Project } from "@/features/projects/model/types";

import {
    countCapCustomFields,
    CUSTOM_FIELD_DEFINITIONS_CAP,
    CUSTOM_FIELD_TASK_TYPES,
    isSystemCustomField,
    sortCustomFieldsByPosition,
} from "@/features/custom-fields/model/constants";
import { useCustomFieldValueUsage } from "@/features/custom-fields/model/use-custom-field-value-usage";
import { useProjectCustomFields } from "@/features/custom-fields/model/use-project-custom-fields";
import { useProjects } from "@/features/projects/model/use-projects";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
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
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
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
import { Spinner } from "@/shared/shadcn/ui/spinner";

const EMPTY_USAGE: CustomFieldValueUsage[] = [];
const TASKS_PAGE_SIZE = 5;

type CustomFieldActions = ReturnType<typeof useProjectCustomFields>;

type FieldRowProperties = {
    canMoveDown: boolean;
    canMoveUp: boolean;
    field: ProjectCustomField;
    fieldsApi: CustomFieldActions;
    onMove: (fieldId: string, direction: -1 | 1) => void;
    onOpenTask?: (taskId: string) => void;
    otherProjects: Project[];
    usageKnown: boolean;
    usageTasks: CustomFieldValueUsage[];
};

type ProjectCustomFieldsSettingsProperties = {
    onOpenTask?: (taskId: string) => void;
    projectId: string;
};

export function ProjectCustomFieldsSettings({
    onOpenTask,
    projectId,
}: ProjectCustomFieldsSettingsProperties) {
    const { t } = useTranslation("board");
    const fieldsApi = useProjectCustomFields(projectId);
    const {
        data: valueUsage = EMPTY_USAGE,
        isError: usageError,
        isLoading: usageLoading,
        refetch: refetchUsage,
    } = useCustomFieldValueUsage(projectId);
    const { data: projects } = useProjects();

    const [newName, setNewName] = useState("");
    const [newAppliesTo, setNewAppliesTo] = useState<CustomFieldTaskType[]>([
        "task",
    ]);
    const [searchQuery, setSearchQuery] = useState("");

    const usageKnown = !usageLoading && !usageError;
    const atCap =
        countCapCustomFields(fieldsApi.fields) >= CUSTOM_FIELD_DEFINITIONS_CAP;

    const projectFields = useMemo(
        () =>
            sortCustomFieldsByPosition(
                fieldsApi.fields.filter(
                    (field) => field.projectId === projectId
                )
            ),
        [fieldsApi.fields, projectId]
    );

    const filteredFields = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return projectFields;
        return projectFields.filter((field) =>
            field.name.toLowerCase().includes(query)
        );
    }, [projectFields, searchQuery]);

    const usageByField = useMemo(() => {
        const map = new Map<string, CustomFieldValueUsage[]>();
        if (!usageKnown) return map;
        for (const row of valueUsage) {
            const list = map.get(row.fieldId);
            if (list) list.push(row);
            else map.set(row.fieldId, [row]);
        }
        return map;
    }, [usageKnown, valueUsage]);

    const otherProjects = useMemo(
        () =>
            (projects ?? []).filter(
                (projectItem) => projectItem.id !== projectId
            ),
        [projects, projectId]
    );

    const toggleNewAppliesTo = (type: CustomFieldTaskType) => {
        setNewAppliesTo((current) => {
            if (current.includes(type)) {
                if (current.length === 1) return current;
                return current.filter((item) => item !== type);
            }
            return [...current, type];
        });
    };

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed || newAppliesTo.length === 0 || atCap) return;

        try {
            const result = await fieldsApi.addCustomField({
                appliesTo: newAppliesTo,
                name: trimmed,
            });
            if (result === null) {
                toast.error(t("customFieldSettings.duplicateName"));
                return;
            }
            if (result === "cap") {
                toast.error(t("customFieldSettings.capReached"));
                return;
            }
            toast.success(t("customFieldSettings.created", { name: trimmed }));
            setNewName("");
            setNewAppliesTo(["task"]);
        } catch {
            toast.error(t("customFieldSettings.updateFailed"));
        }
    };

    const handleReorder = async (fieldId: string, direction: -1 | 1) => {
        const index = projectFields.findIndex((field) => field.id === fieldId);
        const swapIndex = index + direction;
        if (index < 0 || swapIndex < 0 || swapIndex >= projectFields.length) {
            return;
        }
        const next = [...projectFields];
        const [moved] = next.splice(index, 1);
        next.splice(swapIndex, 0, moved!);
        try {
            await fieldsApi.reorderCustomFields(next.map((field) => field.id));
        } catch {
            toast.error(t("customFieldSettings.updateFailed"));
        }
    };

    return (
        <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-h3 font-medium">
                    {t("customFieldSettings.title")}
                </h2>
                <p className="text-ui text-muted-foreground">
                    {t("customFieldSettings.description")}
                </p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <p className="text-ui font-medium">
                    {t("customFieldSettings.addSection")}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Label htmlFor="custom-field-name">
                            {t("customFieldSettings.name")}
                        </Label>
                        <Input
                            disabled={atCap}
                            id="custom-field-name"
                            onChange={(event) => setNewName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleCreate();
                                }
                            }}
                            placeholder={t(
                                "customFieldSettings.newPlaceholder"
                            )}
                            value={newName}
                        />
                    </div>
                    <Button
                        disabled={
                            atCap ||
                            !newName.trim() ||
                            newAppliesTo.length === 0
                        }
                        onClick={() => void handleCreate()}
                        type="button"
                    >
                        {t("customFieldSettings.create")}
                    </Button>
                </div>
                <AppliesToEditor
                    onToggle={toggleNewAppliesTo}
                    selected={newAppliesTo}
                />
                {atCap ? (
                    <Alert>
                        <AlertDescription>
                            {t("customFieldSettings.capReached")}
                        </AlertDescription>
                    </Alert>
                ) : undefined}
            </div>

            {fieldsApi.isLoading ? (
                <div className="flex justify-center py-8">
                    <Spinner className="size-6 text-primary" />
                </div>
            ) : fieldsApi.error ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("customFieldSettings.loadFailed")}
                    </AlertDescription>
                </Alert>
            ) : projectFields.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>
                            {t("customFieldSettings.emptyTitle")}
                        </EmptyTitle>
                        <EmptyDescription>
                            {t("customFieldSettings.emptyDescription")}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <div className="flex flex-col gap-3">
                    {usageKnown ? undefined : (
                        <Alert variant="destructive">
                            <AlertDescription className="flex flex-wrap items-center gap-2">
                                <span>
                                    {t("customFieldSettings.usageLoadFailed")}
                                </span>
                                <Button
                                    onClick={() => void refetchUsage()}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {t("customFieldSettings.retry")}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-8"
                            onChange={(event) =>
                                setSearchQuery(event.target.value)
                            }
                            placeholder={t(
                                "customFieldSettings.searchPlaceholder"
                            )}
                            value={searchQuery}
                        />
                    </div>

                    {filteredFields.length === 0 ? (
                        <p className="text-ui text-muted-foreground">
                            {t("customFieldSettings.noSearchMatches")}
                        </p>
                    ) : (
                        <ul className="divide-y divide-border rounded-lg border border-border">
                            {filteredFields.map((field, index) => (
                                <FieldRow
                                    canMoveDown={
                                        index < filteredFields.length - 1 &&
                                        searchQuery.trim() === ""
                                    }
                                    canMoveUp={
                                        index > 0 && searchQuery.trim() === ""
                                    }
                                    field={field}
                                    fieldsApi={fieldsApi}
                                    key={field.id}
                                    onMove={handleReorder}
                                    onOpenTask={onOpenTask}
                                    otherProjects={otherProjects}
                                    usageKnown={usageKnown}
                                    usageTasks={
                                        usageByField.get(field.id) ??
                                        EMPTY_USAGE
                                    }
                                />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
}

function AppliesToEditor({
    disabled,
    onToggle,
    selected,
}: {
    disabled?: boolean;
    onToggle: (type: CustomFieldTaskType) => void;
    selected: CustomFieldTaskType[];
}) {
    const { t } = useTranslation("board");

    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="text-meta text-muted-foreground">
                {t("customFieldSettings.appliesTo")}
            </legend>
            <div className="flex flex-wrap gap-3">
                {CUSTOM_FIELD_TASK_TYPES.map((type) => {
                    const checked = selected.includes(type);
                    return (
                        <label
                            className="flex items-center gap-2 text-ui"
                            key={type}
                        >
                            <Checkbox
                                checked={checked}
                                disabled={
                                    disabled ||
                                    (checked && selected.length === 1)
                                }
                                onCheckedChange={() => onToggle(type)}
                            />
                            <span className="font-mono text-code">
                                {t(`customFieldSettings.types.${type}`)}
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}

function FieldRow({
    canMoveDown,
    canMoveUp,
    field,
    fieldsApi,
    onMove,
    onOpenTask,
    otherProjects,
    usageKnown,
    usageTasks,
}: FieldRowProperties) {
    const { t } = useTranslation("board");
    const {
        copyCustomFieldToProject,
        deleteCustomField,
        renameCustomField,
        setCustomFieldAppliesTo,
    } = fieldsApi;
    const isSystem = isSystemCustomField(field);

    const [draft, setDraft] = useState(field.name);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [taskPage, setTaskPage] = useState(0);
    const [targetProjectId, setTargetProjectId] = useState<string | undefined>(
        otherProjects[0]?.id
    );

    const usageCount = usageKnown ? usageTasks.length : 0;
    const totalTaskPages = Math.max(1, Math.ceil(usageCount / TASKS_PAGE_SIZE));
    const pageTasks = usageTasks.slice(
        taskPage * TASKS_PAGE_SIZE,
        taskPage * TASKS_PAGE_SIZE + TASKS_PAGE_SIZE
    );

    useEffect(() => {
        setDraft(field.name);
    }, [field.name]);

    useEffect(() => {
        if (deleteOpen) setTaskPage(0);
    }, [deleteOpen]);

    useEffect(() => {
        if (transferOpen) setTargetProjectId(otherProjects[0]?.id);
    }, [otherProjects, transferOpen]);

    const commitRename = async () => {
        const trimmed = draft.trim();
        if (!trimmed || trimmed === field.name) {
            setDraft(field.name);
            return;
        }
        try {
            const ok = await renameCustomField(field.id, trimmed);
            if (!ok) {
                toast.error(t("customFieldSettings.duplicateName"));
                setDraft(field.name);
            }
        } catch {
            toast.error(t("customFieldSettings.updateFailed"));
            setDraft(field.name);
        }
    };

    const toggleAppliesTo = async (type: CustomFieldTaskType) => {
        const next = field.appliesTo.includes(type)
            ? field.appliesTo.filter((item) => item !== type)
            : [...field.appliesTo, type];
        if (next.length === 0) return;
        try {
            await setCustomFieldAppliesTo(field.id, next);
        } catch {
            toast.error(t("customFieldSettings.updateFailed"));
        }
    };

    const handleConfirmDelete = async () => {
        if (!usageKnown) return;
        try {
            await deleteCustomField(field.id);
            toast.success(
                t("customFieldSettings.deleted", { name: field.name })
            );
            setDeleteOpen(false);
        } catch {
            toast.error(t("customFieldSettings.deleteFailed"));
        }
    };

    const handleCopy = async () => {
        if (!targetProjectId) return;
        const target = otherProjects.find(
            (project) => project.id === targetProjectId
        );
        try {
            const result = await copyCustomFieldToProject(
                field.id,
                targetProjectId
            );
            if (result === null) {
                toast.error(t("customFieldSettings.transferDuplicate"));
                return;
            }
            if (result === "cap") {
                toast.error(t("customFieldSettings.transferCap"));
                return;
            }
            toast.success(
                t("customFieldSettings.copied", {
                    name: field.name,
                    target: target?.name ?? "",
                })
            );
            setTransferOpen(false);
        } catch {
            toast.error(t("customFieldSettings.updateFailed"));
        }
    };

    const openTask = (task: CustomFieldValueUsage) => {
        onOpenTask?.(task.taskId);
        setDeleteOpen(false);
    };

    return (
        <li className="flex flex-col gap-2 px-3.5 py-3">
            <div className="flex items-center gap-2">
                <div className="flex shrink-0 flex-col">
                    <Button
                        aria-label={t("customFieldSettings.moveUp")}
                        disabled={!canMoveUp}
                        onClick={() => onMove(field.id, -1)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                    >
                        <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                        aria-label={t("customFieldSettings.moveDown")}
                        disabled={!canMoveDown}
                        onClick={() => onMove(field.id, 1)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                    >
                        <ArrowDown className="size-3.5" />
                    </Button>
                </div>

                <Input
                    aria-label={t("customFieldSettings.renameAria")}
                    className="h-8 min-w-0 flex-1 border-transparent bg-transparent! px-1.5 font-mono text-sm font-medium shadow-none ring-0! focus-visible:border-ring focus-visible:bg-background"
                    onBlur={() => void commitRename()}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                            setDraft(field.name);
                            event.currentTarget.blur();
                        }
                    }}
                    value={draft}
                />

                {isSystem ? (
                    <Badge
                        className="shrink-0 font-mono text-[0.625rem]"
                        variant="secondary"
                    >
                        {t("customFieldSettings.systemBadge")}
                    </Badge>
                ) : usageKnown ? (
                    <Badge
                        className="shrink-0 font-mono text-[0.625rem]"
                        variant="outline"
                    >
                        {t("customFieldSettings.usage", { count: usageCount })}
                    </Badge>
                ) : undefined}

                {isSystem ? undefined : (
                    <>
                        <Button
                            aria-label={t("customFieldSettings.transfer")}
                            disabled={otherProjects.length === 0}
                            onClick={() => setTransferOpen(true)}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        >
                            <ArrowRightLeft className="size-3.5" />
                        </Button>

                        <Button
                            aria-label={t("customFieldSettings.delete")}
                            className="text-muted-foreground hover:text-destructive"
                            disabled={!usageKnown}
                            onClick={() => setDeleteOpen(true)}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        >
                            <X className="size-3.5" />
                        </Button>
                    </>
                )}
            </div>

            <AppliesToEditor
                onToggle={(type) => void toggleAppliesTo(type)}
                selected={field.appliesTo}
            />

            {isSystem ? undefined : (
                <>
                    <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
                        <AlertDialogContent
                            className={
                                usageCount > 0 ? "sm:max-w-md" : undefined
                            }
                            size="sm"
                        >
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {t("customFieldSettings.deleteTitle", {
                                        name: field.name,
                                    })}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {usageKnown
                                        ? usageCount > 0
                                            ? t(
                                                  "customFieldSettings.deleteWithValues",
                                                  {
                                                      count: usageCount,
                                                  }
                                              )
                                            : t(
                                                  "customFieldSettings.deleteEmpty"
                                              )
                                        : t(
                                              "customFieldSettings.usageLoadFailed"
                                          )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            {usageCount > 0 ? (
                                <div className="flex flex-col gap-2">
                                    <ul className="flex flex-col gap-1">
                                        {pageTasks.map((task) => (
                                            <li
                                                className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm"
                                                key={`${task.taskId}-${task.fieldId}`}
                                            >
                                                <button
                                                    className="min-w-0 flex-1 truncate text-left hover:underline"
                                                    onClick={() =>
                                                        openTask(task)
                                                    }
                                                    type="button"
                                                >
                                                    {task.title}
                                                </button>
                                                {task.archivedAt ? (
                                                    <Badge
                                                        className="shrink-0 font-mono text-[0.625rem]"
                                                        variant="outline"
                                                    >
                                                        {t("archive.badge")}
                                                    </Badge>
                                                ) : undefined}
                                                <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground">
                                                    {task.taskKey}
                                                </span>
                                                <Button
                                                    aria-label={t(
                                                        "archive.view"
                                                    )}
                                                    onClick={() =>
                                                        openTask(task)
                                                    }
                                                    size="icon-sm"
                                                    type="button"
                                                    variant="ghost"
                                                >
                                                    <PanelBottom className="size-3.5" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>

                                    {totalTaskPages > 1 ? (
                                        <div className="flex items-center justify-between">
                                            <Button
                                                aria-label={t(
                                                    "customFieldSettings.prevPage"
                                                )}
                                                disabled={taskPage === 0}
                                                onClick={() =>
                                                    setTaskPage((page) =>
                                                        Math.max(0, page - 1)
                                                    )
                                                }
                                                size="icon-sm"
                                                type="button"
                                                variant="outline"
                                            >
                                                <ChevronLeft className="size-4" />
                                            </Button>
                                            <span className="text-meta text-muted-foreground">
                                                {t("customFieldSettings.page", {
                                                    page: taskPage + 1,
                                                    total: totalTaskPages,
                                                })}
                                            </span>
                                            <Button
                                                aria-label={t(
                                                    "customFieldSettings.nextPage"
                                                )}
                                                disabled={
                                                    taskPage >=
                                                    totalTaskPages - 1
                                                }
                                                onClick={() =>
                                                    setTaskPage((page) =>
                                                        Math.min(
                                                            totalTaskPages - 1,
                                                            page + 1
                                                        )
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
                                    {t("customFieldSettings.cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    disabled={!usageKnown}
                                    onClick={() => void handleConfirmDelete()}
                                    variant="destructive"
                                >
                                    {t("customFieldSettings.delete")}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Dialog onOpenChange={setTransferOpen} open={transferOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    {t("customFieldSettings.transferTitle", {
                                        name: field.name,
                                    })}
                                </DialogTitle>
                                <DialogDescription>
                                    {t(
                                        "customFieldSettings.transferDescription"
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor={`transfer-target-${field.id}`}>
                                    {t("customFieldSettings.targetProject")}
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
                                        id={`transfer-target-${field.id}`}
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
                                    {t("customFieldSettings.cancel")}
                                </DialogClose>
                                <Button
                                    disabled={!targetProjectId}
                                    onClick={() => void handleCopy()}
                                    type="button"
                                >
                                    {t("customFieldSettings.copy")}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </li>
    );
}
