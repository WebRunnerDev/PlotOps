import type { CreateTaskDraft } from "@/features/tasks/lib/task-drafts";
import type { TaskPriority, TaskType } from "@/features/tasks/model/types";

import { shouldAutoAssignToCreator } from "@/features/boards";
import { DEFAULT_TASK_PRIORITY } from "@/features/tasks/model/constants";

/** Values shown / submitted by column & backlog quick-add chips. */
export type QuickAddFields = {
    /** `null` = Unassigned. */
    assigneeId: null | string;
    labelIds: string[];
    /** `null` = priority None. */
    priority: null | TaskPriority;
    type: TaskType;
};

/** Restore chip state from a session draft; v1 / missing meta → defaults. */
export function quickAddFieldsFromDraft(
    draft: CreateTaskDraft | null,
    defaults: QuickAddFields
): QuickAddFields {
    if (!draft || draft.v !== 2) {
        return defaults;
    }
    return {
        assigneeId:
            "assigneeId" in draft
                ? (draft.assigneeId ?? null)
                : defaults.assigneeId,
        labelIds: draft.labelIds ?? defaults.labelIds,
        priority:
            "priority" in draft ? (draft.priority ?? null) : defaults.priority,
        type: draft.type ?? defaults.type,
    };
}

/**
 * Initial chip state before the user edits — mirrors createTaskRecord defaults
 * (board default type, medium priority, optional auto-assignee).
 */
export function resolveQuickAddDefaults(input: {
    autoAssignToCreator: boolean;
    currentUserId?: null | string;
    defaultTaskType?: TaskType;
    teamPeopleCount: number;
}): QuickAddFields {
    const assigneeId = shouldAutoAssignToCreator({
        autoAssignToCreator: input.autoAssignToCreator,
        teamPeopleCount: input.teamPeopleCount,
    })
        ? (input.currentUserId ?? null)
        : null;

    return {
        assigneeId,
        labelIds: [],
        priority: DEFAULT_TASK_PRIORITY,
        type: input.defaultTaskType ?? "task",
    };
}

export function toQuickAddDraftMeta(fields: QuickAddFields) {
    return {
        assigneeId: fields.assigneeId,
        labelIds: fields.labelIds,
        priority: fields.priority,
        type: fields.type,
    };
}
