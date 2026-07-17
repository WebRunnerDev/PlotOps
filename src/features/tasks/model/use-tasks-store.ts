import { create } from "zustand";

import type {
    BoardColumn,
    LabelColor,
    ProjectLabel,
    Task,
    TaskStatus,
} from "./types";

import { DEFAULT_KANBAN_COLUMNS, LABEL_COLORS } from "./constants";
import { buildSeedLabels, SEED_LABEL_DEFS } from "./mock-labels";
import { MOCK_TASKS } from "./mock-tasks";

type TaskDetailsUpdate = Partial<Omit<Task, "id" | "status">>;

type TasksState = {
    addColumn: (name?: string) => TaskStatus;
    addLabel: (
        projectId: string,
        name: string,
        color?: LabelColor,
    ) => string | undefined;
    addTask: (task: Task) => void;
    clearSelectedTask: () => void;
    columns: BoardColumn[];
    /** Duplicate a label into another project (new id, same name/color). Returns new id or undefined on duplicate/miss. */
    copyLabelToProject: (
        labelId: string,
        targetProjectId: string,
    ) => string | undefined;
    deleteColumn: (id: TaskStatus, moveTasksTo?: TaskStatus) => boolean;
    /** Delete a label and strip its id from every task that references it. */
    deleteLabel: (labelId: string) => void;
    ensureProjectLabels: (projectId: string) => void;
    labels: ProjectLabel[];
    /** Move a label to another project: copy it there, then detach + delete it from the source. */
    moveLabelToProject: (labelId: string, targetProjectId: string) => void;
    /** Move a task into the column of `overId` (task id or column id). Cross-column only. */
    moveTaskToColumn: (activeId: string, overId: string) => void;
    renameColumn: (id: TaskStatus, name: string) => boolean;
    /** Rename a label; fails on empty or a duplicate name within the same project. */
    renameLabel: (labelId: string, name: string) => boolean;
    /** Reorder a task within its column to sit at `overId`'s position (arrayMove). */
    reorderTaskWithin: (activeId: string, overId: string) => void;
    reorderColumns: (activeId: TaskStatus, overId: TaskStatus) => void;
    selectedTaskId?: string;
    selectTask: (id: string) => void;
    /** Set a custom hex color on a label, keeping the preset as a fallback. */
    setLabelCustomColor: (labelId: string, hex: string) => void;
    tasks: Task[];
    toggleTaskLabel: (taskId: string, labelId: string) => void;
    /** Apply a preset color and drop any custom color the label had. */
    updateLabelColor: (labelId: string, color: LabelColor) => void;
    updateTaskDetails: (id: string, details: TaskDetailsUpdate) => void;
    updateTaskStatus: (id: string, status: TaskStatus) => void;
};

function createColumnId(): TaskStatus {
    return `col_${crypto.randomUUID().slice(0, 8)}`;
}

function createLabelId(): string {
    return `lbl_${crypto.randomUUID().slice(0, 8)}`;
}

function isUniqueColumnName(
    columns: BoardColumn[],
    name: string,
    exceptId?: TaskStatus,
): boolean {
    const normalized = name.trim().toLowerCase();
    return !columns.some(
        (column) =>
            column.id !== exceptId &&
            column.name.trim().toLowerCase() === normalized,
    );
}

export const useTasksStore = create<TasksState>((set, get) => ({
    addColumn: (name) => {
        const columns = get().columns;
        const baseName = name?.trim() || "New status";
        let nextName = baseName;
        let suffix = 2;

        while (!isUniqueColumnName(columns, nextName)) {
            nextName = `${baseName} ${suffix}`;
            suffix += 1;
        }

        const id = createColumnId();
        set((state) => ({
            columns: [...state.columns, { id, name: nextName }],
        }));
        return id;
    },

    addLabel: (projectId, name, color) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        const projectLabels = get().labels.filter(
            (label) => label.projectId === projectId,
        );
        const duplicate = projectLabels.some(
            (label) => label.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (duplicate) return;

        const id = createLabelId();
        const nextColor =
            color ?? LABEL_COLORS[projectLabels.length % LABEL_COLORS.length]!;

        set((state) => ({
            labels: [
                ...state.labels,
                { color: nextColor, id, name: trimmed, projectId },
            ],
        }));
        return id;
    },

    addTask: (task) =>
        set((state) => ({
            tasks: [...state.tasks, task],
        })),

    clearSelectedTask: () => set({ selectedTaskId: undefined }),

    columns: DEFAULT_KANBAN_COLUMNS,

    copyLabelToProject: (labelId, targetProjectId) => {
        const label = get().labels.find((item) => item.id === labelId);
        if (!label || label.projectId === targetProjectId) return;

        const id = get().addLabel(targetProjectId, label.name, label.color);
        if (id && label.customColor) {
            get().setLabelCustomColor(id, label.customColor);
        }
        return id;
    },

    deleteColumn: (id, moveTasksTo) => {
        const { columns, tasks } = get();
        if (columns.length <= 1) return false;
        if (!columns.some((column) => column.id === id)) return false;

        const hasTasks = tasks.some((task) => task.status === id);
        if (hasTasks) {
            if (!moveTasksTo || moveTasksTo === id) return false;
            if (!columns.some((column) => column.id === moveTasksTo)) {
                return false;
            }
        }

        set((state) => ({
            columns: state.columns.filter((column) => column.id !== id),
            tasks: hasTasks
                ? state.tasks.map((task) =>
                      task.status === id
                          ? { ...task, status: moveTasksTo }
                          : task,
                  )
                : state.tasks,
        }));
        return true;
    },

    deleteLabel: (labelId) => {
        if (!get().labels.some((label) => label.id === labelId)) return;

        set((state) => ({
            labels: state.labels.filter((label) => label.id !== labelId),
            tasks: state.tasks.map((task) => {
                if (!task.labelIds?.includes(labelId)) return task;
                const next = task.labelIds.filter((id) => id !== labelId);
                return {
                    ...task,
                    labelIds: next.length > 0 ? next : undefined,
                };
            }),
        }));
    },

    ensureProjectLabels: (projectId) => {
        const hasForProject = get().labels.some(
            (label) => label.projectId === projectId,
        );
        if (hasForProject) return;

        const seedIdsTaken = get().labels.some((label) =>
            SEED_LABEL_DEFS.some((seed) => seed.id === label.id),
        );

        if (!seedIdsTaken) {
            set((state) => ({
                labels: [...state.labels, ...buildSeedLabels(projectId)],
            }));
            return;
        }

        set((state) => ({
            labels: [
                ...state.labels,
                ...SEED_LABEL_DEFS.map((seed) => ({
                    color: seed.color,
                    id: createLabelId(),
                    name: seed.name,
                    projectId,
                })),
            ],
        }));
    },

    labels: [],

    moveLabelToProject: (labelId, targetProjectId) => {
        const label = get().labels.find((item) => item.id === labelId);
        if (!label || label.projectId === targetProjectId) return;

        // Copy into the target project (skipped if a same-name label exists there),
        // then remove the original — detaching it from source-project tasks.
        get().copyLabelToProject(labelId, targetProjectId);
        get().deleteLabel(labelId);
    },

    moveTaskToColumn: (activeId, overId) => {
        if (activeId === overId) return;

        set((state) => {
            const { columns, tasks } = state;
            const activeIndex = tasks.findIndex((task) => task.id === activeId);
            if (activeIndex === -1) return state;

            const activeTask = tasks[activeIndex]!;
            const overTask = tasks.find((task) => task.id === overId);
            const overIsColumn = columns.some((column) => column.id === overId);
            if (!overTask && !overIsColumn) return state;

            const targetStatus = overTask ? overTask.status : overId;
            // Same-column reordering is handled visually by the sort strategy
            // and committed on drop — do not mutate the array here.
            if (activeTask.status === targetStatus) return state;

            const next = tasks.filter((task) => task.id !== activeId);
            const updated = { ...activeTask, status: targetStatus };

            let insertIndex: number;
            if (overTask) {
                insertIndex = next.findIndex((task) => task.id === overId);
                if (insertIndex === -1) insertIndex = next.length;
            } else {
                let lastIndex = -1;
                for (const [index, task] of next.entries()) {
                    if (task.status === targetStatus) lastIndex = index;
                }
                insertIndex = lastIndex + 1;
            }

            next.splice(insertIndex, 0, updated);
            return { tasks: next };
        });
    },

    renameColumn: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return false;

        const { columns } = get();
        if (!columns.some((column) => column.id === id)) return false;
        if (!isUniqueColumnName(columns, trimmed, id)) return false;

        set((state) => ({
            columns: state.columns.map((column) =>
                column.id === id ? { ...column, name: trimmed } : column,
            ),
        }));
        return true;
    },

    renameLabel: (labelId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return false;

        const { labels } = get();
        const label = labels.find((item) => item.id === labelId);
        if (!label) return false;

        const duplicate = labels.some(
            (item) =>
                item.id !== labelId &&
                item.projectId === label.projectId &&
                item.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (duplicate) return false;

        set((state) => ({
            labels: state.labels.map((item) =>
                item.id === labelId ? { ...item, name: trimmed } : item,
            ),
        }));
        return true;
    },

    reorderColumns: (activeId, overId) => {
        if (activeId === overId) return;

        set((state) => {
            const oldIndex = state.columns.findIndex(
                (column) => column.id === activeId,
            );
            const newIndex = state.columns.findIndex(
                (column) => column.id === overId,
            );
            if (oldIndex === -1 || newIndex === -1) return state;

            const next = [...state.columns];
            const [moved] = next.splice(oldIndex, 1);
            if (!moved) return state;
            next.splice(newIndex, 0, moved);
            return { columns: next };
        });
    },

    reorderTaskWithin: (activeId, overId) => {
        if (activeId === overId) return;

        set((state) => {
            const { tasks } = state;
            const activeIndex = tasks.findIndex((task) => task.id === activeId);
            const overIndex = tasks.findIndex((task) => task.id === overId);
            if (activeIndex === -1 || overIndex === -1) return state;
            if (activeIndex === overIndex) return state;

            const next = [...tasks];
            const [moved] = next.splice(activeIndex, 1);
            if (!moved) return state;
            next.splice(overIndex, 0, moved);
            return { tasks: next };
        });
    },

    selectedTaskId: undefined,

    selectTask: (id) => set({ selectedTaskId: id }),

    setLabelCustomColor: (labelId, hex) =>
        set((state) => ({
            labels: state.labels.map((label) =>
                label.id === labelId
                    ? { ...label, customColor: hex }
                    : label,
            ),
        })),

    tasks: MOCK_TASKS,

    toggleTaskLabel: (taskId, labelId) =>
        set((state) => ({
            tasks: state.tasks.map((task) => {
                if (task.id !== taskId) return task;
                const current = task.labelIds ?? [];
                const next = current.includes(labelId)
                    ? current.filter((id) => id !== labelId)
                    : [...current, labelId];
                return {
                    ...task,
                    labelIds: next.length > 0 ? next : undefined,
                };
            }),
        })),

    updateLabelColor: (labelId, color) =>
        set((state) => ({
            labels: state.labels.map((label) =>
                label.id === labelId
                    ? { ...label, color, customColor: undefined }
                    : label,
            ),
        })),

    updateTaskDetails: (id, details) =>
        set((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === id ? { ...task, ...details } : task,
            ),
        })),

    updateTaskStatus: (id, status) => {
        const columnExists = get().columns.some(
            (column) => column.id === status,
        );
        if (!columnExists) return;

        set((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === id ? { ...task, status } : task,
            ),
        }));
    },
}));
