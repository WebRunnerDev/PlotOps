import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { QuickAddFields } from "@/features/tasks/lib/resolve-quick-add-defaults";

import { useAuth } from "@/features/auth";
import { countTeamPeople, useProjectBoards } from "@/features/boards";
import { GUEST_SEED_ACTOR_ID, isGuest } from "@/features/guest-mode";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    useProjectMembers,
    useProjectOwnerProfile,
} from "@/features/projects/model/use-project-members";
import { useProject } from "@/features/projects/model/use-projects";
import {
    TASK_TITLE_MAX_LENGTH,
    type TaskStatus,
    useBoardTasks,
    useTaskDrawerPreferencesStore,
    useTasksUiStore,
} from "@/features/tasks";
import {
    quickAddFieldsFromDraft,
    resolveQuickAddDefaults,
    toQuickAddDraftMeta,
} from "@/features/tasks/lib/resolve-quick-add-defaults";
import { maybeSelectCreatedTask } from "@/features/tasks/lib/resolve-task-drawer-placement";
import {
    clearCreateTaskDraft,
    getCreateTaskDraft,
    setCreateTaskDraft,
} from "@/features/tasks/lib/task-drafts";
import { TaskQuickAddChips } from "@/features/tasks/ui/task-quick-add-chips";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import { resolveBoardNewTaskCtaVisible } from "@/widgets/kanban-board/model/resolve-board-new-task-cta-visible";

type KanbanAddTaskProperties = {
    boardId: string;
    /** Sprint to join on create when board is scoped to Active Sprint. */
    createSprintId?: string;
    projectId: string;
    /** Open the inline composer (e.g. board chrome + New Task). */
    startOpen?: boolean;
    status: TaskStatus;
};

export function KanbanAddTask({
    boardId,
    createSprintId,
    projectId,
    startOpen = false,
    status,
}: KanbanAddTaskProperties) {
    const { t } = useTranslation("board");
    const { user } = useAuth();
    const guest = isGuest();
    const { createTask } = useBoardTasks(projectId, boardId);
    const { canCreateTasks, isSettled } = useProjectAccess(projectId);
    const canCreate = resolveBoardNewTaskCtaVisible({
        canCreateTasks,
        isSettled,
    });
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const openAfterCreate = useTaskDrawerPreferencesStore(
        (state) => state.openAfterCreate
    );
    const { data: boards = [] } = useProjectBoards(projectId);
    const board = boards.find((item) => item.id === boardId);
    const { data: project } = useProject(projectId);
    const { data: members = [] } = useProjectMembers(projectId);
    const { data: ownerProfile } = useProjectOwnerProfile(project?.owner_id);

    const defaults = useMemo(() => {
        const teamPeopleCount = guest
            ? 1
            : countTeamPeople({
                  hasOwner: Boolean(ownerProfile ?? project?.owner_id),
                  memberCount: members.length,
              });
        return resolveQuickAddDefaults({
            autoAssignToCreator: board?.autoAssignToCreator === true,
            currentUserId: guest ? GUEST_SEED_ACTOR_ID : (user?.id ?? null),
            defaultTaskType: board?.defaultTaskType,
            teamPeopleCount,
        });
    }, [
        board?.autoAssignToCreator,
        board?.defaultTaskType,
        guest,
        members.length,
        ownerProfile,
        project?.owner_id,
        user?.id,
    ]);

    const [open, setOpen] = useState(startOpen);
    const [title, setTitle] = useState("");
    const [fields, setFields] = useState<QuickAddFields>(defaults);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [chipMenuOpen, setChipMenuOpen] = useState(false);
    const [draftTitle, setDraftTitle] = useState<null | string>(() => {
        return getCreateTaskDraft(boardId, status)?.title ?? null;
    });
    const inputReference = useRef<HTMLInputElement>(null);
    const skipBlurSubmit = useRef(false);
    const defaultsReference = useRef(defaults);
    defaultsReference.current = defaults;

    useEffect(() => {
        setDraftTitle(getCreateTaskDraft(boardId, status)?.title ?? null);
    }, [boardId, status]);

    useEffect(() => {
        if (!startOpen) return;
        setOpen(true);
        queueMicrotask(() => {
            inputReference.current?.focus();
        });
    }, [startOpen]);

    useEffect(() => {
        if (!open) return;
        const currentDefaults = defaultsReference.current;
        const draft = getCreateTaskDraft(boardId, status);
        if (draft) {
            setTitle(draft.title);
            setDraftTitle(draft.title);
            setFields(quickAddFieldsFromDraft(draft, currentDefaults));
        } else {
            setFields(currentDefaults);
        }
        inputReference.current?.focus();
    }, [boardId, open, status]);

    useEffect(() => {
        if (!open || chipMenuOpen) return;
        inputReference.current?.focus();
    }, [chipMenuOpen, open]);

    const persistDraft = (nextTitle: string, nextFields: QuickAddFields) => {
        const trimmed = nextTitle.trim();
        if (trimmed) {
            setCreateTaskDraft(
                boardId,
                status,
                trimmed,
                toQuickAddDraftMeta(nextFields)
            );
            setDraftTitle(trimmed);
        } else {
            clearCreateTaskDraft(boardId, status);
            setDraftTitle(null);
        }
    };

    const closeComposer = () => {
        persistDraft(title, fields);
        setOpen(false);
        setTitle("");
        setFields(defaults);
    };

    const submit = async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            clearCreateTaskDraft(boardId, status);
            setDraftTitle(null);
            setOpen(false);
            setTitle("");
            setFields(defaults);
            return;
        }
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const task = await createTask(status, trimmed, {
                assigneeId: fields.assigneeId,
                labelIds: fields.labelIds,
                priority: fields.priority,
                sprintId: createSprintId,
                taskType: fields.type,
            });
            clearCreateTaskDraft(boardId, status);
            setDraftTitle(null);
            maybeSelectCreatedTask(task.id, {
                openAfterCreate,
                selectTask,
            });
            setOpen(false);
            setTitle("");
            setFields(defaults);
        } catch {
            toast.error(t("tasks.createFailed"));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!canCreate) {
        return null;
    }

    if (!open) {
        return (
            <Button
                className="h-9 w-full justify-start gap-2 text-muted-foreground sm:h-8"
                onClick={() => setOpen(true)}
                type="button"
                variant="ghost"
            >
                <Plus className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">
                    {draftTitle ?? t("tasks.add")}
                </span>
                {draftTitle ? (
                    <Badge
                        className="shrink-0 rounded-sm font-mono text-[0.625rem]"
                        variant="outline"
                    >
                        {t("tasks.draft")}
                    </Badge>
                ) : null}
            </Button>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            {draftTitle || title.trim() ? (
                <div className="flex justify-end">
                    <Badge
                        className="rounded-sm font-mono text-[0.625rem]"
                        variant="outline"
                    >
                        {t("tasks.unsaved")}
                    </Badge>
                </div>
            ) : null}
            <Input
                aria-label={t("tasks.addPlaceholder")}
                className="h-8 bg-background text-ui shadow-none"
                disabled={isSubmitting}
                maxLength={TASK_TITLE_MAX_LENGTH}
                onBlur={() => {
                    if (skipBlurSubmit.current) {
                        skipBlurSubmit.current = false;
                        return;
                    }
                    if (chipMenuOpen) return;
                    closeComposer();
                }}
                onChange={(event) => {
                    const next = event.target.value;
                    setTitle(next);
                    persistDraft(next, fields);
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        skipBlurSubmit.current = true;
                        void submit();
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        skipBlurSubmit.current = true;
                        closeComposer();
                    }
                }}
                placeholder={t("tasks.addPlaceholder")}
                ref={inputReference}
                value={title}
            />
            <TaskQuickAddChips
                disabled={isSubmitting}
                fields={fields}
                onFieldsChange={(next) => {
                    setFields(next);
                    persistDraft(title, next);
                }}
                onMenuOpenChange={setChipMenuOpen}
                projectId={projectId}
            />
        </div>
    );
}
